// lib/blogSheetHelpers.ts
import { getSheetsClient, SPREADSHEET_ID } from './googlesheet';

const BLOG_SHEET_NAME = 'blog';

export interface BlogPost {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  blogURL: string;
  authorName: string;
  authorBio: string;
  authorAvatar: string;
  tags: string[];
  image: string;
  readTime: string;
  featured: boolean;
  status: 'draft' | 'published' | 'archived';
  category: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

// Cache for blog data with TTL
interface CacheEntry {
  data: BlogPost[];
  timestamp: number;
  ttl: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let blogCache: CacheEntry | null = null;

// Rate limiting
const rateLimiter = {
  requests: [] as number[],
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  
  canMakeRequest(): boolean {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
};

// Helper function to validate and normalize blog data
function normalizeBlogPost(row: any[], index: number): BlogPost {
  return {
    id: Number(row[0]) || index + 1,
    title: (row[1] || '').toString().trim(),
    excerpt: (row[2] || '').toString().trim(),
    content: (row[3] || '').toString(),
    blogURL: (row[4] || '').toString().trim(),
    authorName: (row[5] || '').toString().trim(),
    authorBio: (row[6] || '').toString().trim(),
    authorAvatar: (row[7] || '').toString().trim(),
    tags: row[8] ? row[8].toString().split(',').map((tag: string) => tag.trim()).filter(Boolean) : [],
    image: (row[9] || '').toString().trim(),
    readTime: (row[10] || '').toString().trim(),
    featured: row[11] === 'true' || row[11] === true,
    status: (['draft', 'published', 'archived'].includes(row[12]) ? row[12] : 'draft') as 'draft' | 'published' | 'archived',
    category: (row[13] || '').toString().trim(),
    date: row[14] || new Date().toISOString().split('T')[0],
    createdAt: row[15] || new Date().toISOString(),
    updatedAt: row[16] || new Date().toISOString(),
  };
}

// Optimized read function with caching
export async function readBlogFromSheet(useCache: boolean = true): Promise<BlogPost[]> {
  // Check cache first
  if (useCache && blogCache) {
    const now = Date.now();
    if (now - blogCache.timestamp < blogCache.ttl) {
      return blogCache.data;
    }
  }

  // Rate limiting check
  if (!rateLimiter.canMakeRequest()) {
    if (blogCache) {
      // Return stale cache if rate limited
      return blogCache.data;
    }
    throw new Error('Rate limit exceeded. Please try again later.');
  }

  try {
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BLOG_SHEET_NAME}!A2:Q`,
    });

    const rows = response.data.values || [];
    const blogData = rows.map((row, index) => normalizeBlogPost(row, index));

    // Update cache
    blogCache = {
      data: blogData,
      timestamp: Date.now(),
      ttl: CACHE_TTL
    };

    return blogData;
  } catch (error) {
    console.error('Error reading blog data:', error);
    
    // Return cached data if available during error
    if (blogCache) {
      return blogCache.data;
    }
    
    throw error;
  }
}

// Batch operations for better performance
export async function writeBlogToSheet(blogs: BlogPost[]): Promise<{ success: boolean; updated: number; added: number; errors: string[] }> {
  if (!blogs || blogs.length === 0) {
    return { success: true, updated: 0, added: 0, errors: [] };
  }

  const errors: string[] = [];
  
  try {
    const sheets = await getSheetsClient();

    // Read existing data (use cache to reduce API calls)
    const existingBlogs = await readBlogFromSheet(true);
    
    // Create lookup structures for efficient processing
    const existingBlogMap = new Map(
      existingBlogs.map((blog, index) => [blog.id.toString(), { blog, rowIndex: index + 2 }])
    );

    // Process blogs in batches
    const batchSize = 10; // Process 10 blogs at a time
    const batches = [];
    
    for (let i = 0; i < blogs.length; i += batchSize) {
      batches.push(blogs.slice(i, i + batchSize));
    }

    let totalUpdated = 0;
    let totalAdded = 0;

    for (const batch of batches) {
      const batchUpdates: { blog: BlogPost; rowIndex: number }[] = [];
      const batchAdds: BlogPost[] = [];

      batch.forEach((blog) => {
        try {
          const blogId = blog.id.toString();
          const existingData = existingBlogMap.get(blogId);
          
          if (existingData) {
            // Check if update is needed
            if (hasBlogChanged(existingData.blog, blog)) {
              batchUpdates.push({ 
                blog: { ...blog, updatedAt: new Date().toISOString() }, 
                rowIndex: existingData.rowIndex 
              });
            }
          } else {
            // New blog
            batchAdds.push({ 
              ...blog, 
              createdAt: blog.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        } catch (error) {
          errors.push(`Error processing blog ${blog.id}: ${error}`);
        }
      });

      // Execute batch updates
      if (batchUpdates.length > 0) {
        try {
          await Promise.allSettled(batchUpdates.map(async ({ blog, rowIndex }) => {
            const values = blogToSheetRow(blog);
            
            return sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${BLOG_SHEET_NAME}!A${rowIndex}:Q${rowIndex}`,
              valueInputOption: 'RAW',
              requestBody: { values: [values] },
            });
          }));
          
          totalUpdated += batchUpdates.length;
        } catch (error) {
          errors.push(`Batch update error: ${error}`);
        }
      }

      // Execute batch adds
      if (batchAdds.length > 0) {
        try {
          const newRows = batchAdds.map(blog => blogToSheetRow(blog));

          await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${BLOG_SHEET_NAME}!A2:Q`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: newRows },
          });
          
          totalAdded += batchAdds.length;
        } catch (error) {
          errors.push(`Batch add error: ${error}`);
        }
      }
    }

    // Invalidate cache after successful write
    blogCache = null;

    return { 
      success: errors.length === 0, 
      updated: totalUpdated, 
      added: totalAdded,
      errors
    };

  } catch (error) {
    console.error('Error in writeBlogToSheet:', error);
    return { 
      success: false, 
      updated: 0, 
      added: 0, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    };
  }
}

// Helper function to convert blog to sheet row
function blogToSheetRow(blog: BlogPost): any[] {
  return [
    blog.id,
    blog.title,
    blog.excerpt,
    blog.content,
    blog.blogURL,
    blog.authorName,
    blog.authorBio,
    blog.authorAvatar,
    Array.isArray(blog.tags) ? blog.tags.join(', ') : blog.tags,
    blog.image,
    blog.readTime,
    blog.featured ? 'true' : 'false',
    blog.status,
    blog.category,
    blog.date,
    blog.createdAt,
    blog.updatedAt,
  ];
}

// Optimized change detection
function hasBlogChanged(existing: BlogPost, incoming: BlogPost): boolean {
  // Quick reference check first
  if (existing === incoming) return false;
  
  // Check critical fields that are most likely to change
  const criticalFields = ['title', 'content', 'status', 'featured'] as const;
  
  for (const field of criticalFields) {
    if (existing[field] !== incoming[field]) {
      return true;
    }
  }
  
  // Check tags separately due to array comparison
  const existingTags = Array.isArray(existing.tags) ? existing.tags.join(', ') : existing.tags;
  const incomingTags = Array.isArray(incoming.tags) ? incoming.tags.join(', ') : incoming.tags;
  if (existingTags !== incomingTags) {
    return true;
  }
  
  // Check other fields
  const otherFields = [
    'excerpt', 'blogURL', 'authorName', 'authorBio', 'authorAvatar', 
    'image', 'readTime', 'category', 'date'
  ] as const;
  
  return otherFields.some(field => (existing[field] || '') !== (incoming[field] || ''));
}

// Optimized delete function with batch support
export async function deleteBlogFromSheet(blogIds: number | number[]): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  const ids = Array.isArray(blogIds) ? blogIds : [blogIds];
  const errors: string[] = [];
  
  try {
    const sheets = await getSheetsClient();

    // Read existing data to find rows to delete
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BLOG_SHEET_NAME}!A2:Q`,
    });

    const existingRows = response.data.values || [];
    
    // Find all rows to delete
    const rowsToDelete: number[] = [];
    existingRows.forEach((row, index) => {
      if (ids.includes(Number(row[0]))) {
        rowsToDelete.push(index + 2); // +2 because A2 is row 2
      }
    });

    if (rowsToDelete.length === 0) {
      return { success: false, deleted: 0, errors: ['No matching blogs found'] };
    }

    // Sort in descending order to delete from bottom to top
    rowsToDelete.sort((a, b) => b - a);

    // Delete rows in batches
    const deleteRequests = rowsToDelete.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId: 0,
          dimension: 'ROWS',
          startIndex: rowIndex - 1,
          endIndex: rowIndex,
        },
      },
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: deleteRequests },
    });

    // Invalidate cache after successful delete
    blogCache = null;

    return { success: true, deleted: rowsToDelete.length, errors: [] };

  } catch (error) {
    console.error('Error deleting blogs:', error);
    return { 
      success: false, 
      deleted: 0, 
      errors: [error instanceof Error ? error.message : 'Unknown error'] 
    };
  }
}

// Optimized single blog add with deduplication
export async function addSingleBlog(blog: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; id?: number; message?: string }> {
  try {
    const existingBlogs = await readBlogFromSheet(true);
    
    // More sophisticated duplicate detection
    const isDuplicate = existingBlogs.some(existingBlog => {
      const titleMatch = existingBlog.title.toLowerCase().trim() === blog.title.toLowerCase().trim();
      const urlMatch = existingBlog.blogURL && blog.blogURL && existingBlog.blogURL === blog.blogURL;
      return titleMatch || urlMatch;
    });
    
    if (isDuplicate) {
      return { success: false, message: 'A blog with this title or URL already exists' };
    }
    
    // Generate new ID more efficiently
    const newId = existingBlogs.length > 0 ? Math.max(...existingBlogs.map(b => b.id)) + 1 : 1;
    
    const newBlog: BlogPost = {
      ...blog,
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const result = await writeBlogToSheet([newBlog]);
    
    if (result.success) {
      return { success: true, id: newId };
    } else {
      return { success: false, message: 'Failed to add blog: ' + result.errors.join(', ') };
    }
  } catch (error) {
    console.error('Error adding single blog:', error);
    return { success: false, message: 'Failed to add blog due to an error' };
  }
}

// Utility function to clear cache manually
export function clearBlogCache(): void {
  blogCache = null;
}

// Utility function to get cache status
export function getCacheStatus(): { cached: boolean; age: number; ttl: number } {
  if (!blogCache) {
    return { cached: false, age: 0, ttl: 0 };
  }
  
  const age = Date.now() - blogCache.timestamp;
  return {
    cached: true,
    age,
    ttl: blogCache.ttl
  };
}