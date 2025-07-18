// app/api/blog/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { 
  readBlogFromSheet, 
  writeBlogToSheet, 
  deleteBlogFromSheet, 
  addSingleBlog,
  clearBlogCache,
  getCacheStatus,
  BlogPost 
} from '@/lib/blogSheetHelpers';

// Response caching headers
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=300, s-maxage=600', // 5 min client, 10 min CDN
  'Vary': 'Accept-Encoding',
};

// Rate limiting per IP
const ipRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const userLimit = ipRateLimit.get(ip);
  
  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit
    ipRateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetTime: now + RATE_LIMIT_WINDOW };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetTime: userLimit.resetTime };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count, resetTime: userLimit.resetTime };
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

// Optimized GET endpoint with caching and filtering
export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Rate limit exceeded',
        resetTime: rateLimit.resetTime 
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }

  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    
    // Query parameters for filtering
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const search = searchParams.get('search');
    const useCache = searchParams.get('cache') !== 'false';
    
    // Get cache status for debugging
    const cacheStatus = getCacheStatus();
    
    let blogData = await readBlogFromSheet(useCache);
    
    // Apply filters
    if (status) {
      blogData = blogData.filter(blog => blog.status === status);
    }
    
    if (category) {
      blogData = blogData.filter(blog => 
        blog.category.toLowerCase().includes(category.toLowerCase())
      );
    }
    
    if (featured === 'true') {
      blogData = blogData.filter(blog => blog.featured);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      blogData = blogData.filter(blog => 
        blog.title.toLowerCase().includes(searchLower) ||
        blog.excerpt.toLowerCase().includes(searchLower) ||
        blog.content.toLowerCase().includes(searchLower) ||
        blog.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    // Sort by date (newest first) by default
    blogData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Apply pagination
    const totalCount = blogData.length;
    const offsetNum = parseInt(offset || '0', 10);
    const limitNum = parseInt(limit || '0', 10);
    
    if (limitNum > 0) {
      blogData = blogData.slice(offsetNum, offsetNum + limitNum);
    }
    
    const response = NextResponse.json({
      success: true,
      data: blogData,
      meta: {
        total: totalCount,
        count: blogData.length,
        offset: offsetNum,
        limit: limitNum || totalCount,
        cached: cacheStatus.cached,
        cacheAge: cacheStatus.age,
      }
    });
    
    // Add cache headers
    Object.entries(CACHE_HEADERS).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
    
    return response;
    
  } catch (error) {
    console.error('Error fetching blog data:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch blog data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }
}

// Optimized POST endpoint with validation and batch processing
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }

  try {
    const body = await request.json();
    const { blogs, operation = 'upsert' } = body;
    
    // Validate input
    if (!blogs || (!Array.isArray(blogs) && typeof blogs !== 'object')) {
      return NextResponse.json(
        { success: false, error: 'Invalid blog data format' },
        { status: 400 }
      );
    }
    
    let result;
    
    if (operation === 'add' && !Array.isArray(blogs)) {
      // Single blog add
      result = await addSingleBlog(blogs);
    } else {
      // Batch upsert
      const blogArray = Array.isArray(blogs) ? blogs : [blogs];
      
      // Validate each blog
      const validationErrors: string[] = [];
      blogArray.forEach((blog, index) => {
        if (!blog.title || !blog.content) {
          validationErrors.push(`Blog ${index + 1}: Title and content are required`);
        }
        if (blog.title && blog.title.length > 200) {
          validationErrors.push(`Blog ${index + 1}: Title too long (max 200 characters)`);
        }
      });
      
      if (validationErrors.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Validation failed', details: validationErrors },
          { status: 400 }
        );
      }
      
      result = await writeBlogToSheet(blogArray);
    }
    
    const response = NextResponse.json({
      // success: result.success,
      message: result.success ? 'Blog data saved successfully' : 'Failed to save blog data',
      ...result
    });
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
    
    return response;
    
  } catch (error) {
    console.error('Error saving blog data:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save blog data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }
}

// Optimized DELETE endpoint with batch support
export async function DELETE(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const blogId = searchParams.get('id');
    const blogIds = searchParams.get('ids');
    
    if (!blogId && !blogIds) {
      return NextResponse.json(
        { success: false, error: 'Blog ID(s) required' },
        { status: 400 }
      );
    }
    
    let idsToDelete: number[];
    
    if (blogIds) {
      // Batch delete
      try {
        idsToDelete = blogIds.split(',').map(id => parseInt(id.trim(), 10));
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid blog IDs format' },
          { status: 400 }
        );
      }
    } else {
      // Single delete
      const id = parseInt(blogId!, 10);
      if (isNaN(id)) {
        return NextResponse.json(
          { success: false, error: 'Invalid blog ID' },
          { status: 400 }
        );
      }
      idsToDelete = [id];
    }
    
    const result = await deleteBlogFromSheet(idsToDelete);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete blog(s)', details: result.errors },
        { status: 404 }
      );
    }
    
    const response = NextResponse.json({
      success: true,
      message: `${result.deleted} blog(s) deleted successfully`,
      deleted: result.deleted
    });
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Remaining', rateLimit.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimit.resetTime.toString());
    
    return response;
    
  } catch (error) {
    console.error('Error deleting blog:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete blog',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetTime.toString(),
        }
      }
    );
  }
}

// Utility endpoint for cache management
export async function PATCH(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rateLimit = checkRateLimit(clientIP);
  
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  try {
    const { action } = await request.json();
    
    if (action === 'clear-cache') {
      clearBlogCache();
      return NextResponse.json({ success: true, message: 'Cache cleared successfully' });
    }
    
    if (action === 'cache-status') {
      const status = getCacheStatus();
      return NextResponse.json({ success: true, cache: status });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('Error in PATCH endpoint:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-static';