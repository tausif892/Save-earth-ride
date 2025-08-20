'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Camera, Plus, Edit, Trash2, Save, X, MapPin, Calendar,
  ArrowLeft, Bike, Image as ImageIcon, Filter, Upload, RefreshCw, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface GalleryItem {
  id: number;
  image: string;
  title: string;
  location: string;
  city: string;
  year: string;
  tags: string[];
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

// Google Drive Image parsing utility functions
const parseGoogleDriveImageUrl = (driveLink: string) => {
  try {
    if (!driveLink) return '';
    
    // Handle different Google Drive link formats
    let fileId = '';
    
    // Format 1: https://drive.google.com/file/d/FILE_ID/view
    if (driveLink.includes('/file/d/')) {
      const match = driveLink.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    }
    
    // Format 2: https://drive.google.com/open?id=FILE_ID
    else if (driveLink.includes('open?id=')) {
      const match = driveLink.match(/id=([a-zA-Z0-9_-]+)/);
      if (match) fileId = match[1];
    }
    
    // Format 3: Already in direct format
    else if (driveLink.includes('drive.google.com/uc?') || driveLink.includes('drive.google.com/thumbnail?')) {
      return driveLink;
    }
    
    // If it's a regular URL (not Google Drive), return as is
    else if (driveLink.startsWith('http') && !driveLink.includes('drive.google.com')) {
      return driveLink;
    }
    
    if (!fileId) {
      return driveLink; // Return original link as fallback
    }
    
    // Convert to direct image URL
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    
  } catch (error) {
    console.error('Error parsing image URL:', error);
    return driveLink;
  }
};

// Gallery Image Preview Component
const GalleryImagePreview = ({ src, alt, className = "", onError }: { 
  src: string; 
  alt: string; 
  className?: string; 
  onError?: () => void;
}) => {
  const [imageSrc, setImageSrc] = useState('');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (src) {
      setIsLoading(true);
      setHasError(false);
      const parsedSrc = parseGoogleDriveImageUrl(src);
      setImageSrc(parsedSrc);
    }
  }, [src]);

  const handleError = () => {
    if (!hasError && src.includes('drive.google.com')) {
      setHasError(true);
      // Try alternative format if thumbnail fails
      const fileIdMatch = src.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || src.match(/id=([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        setImageSrc(`https://drive.google.com/uc?export=view&id=${fileIdMatch[1]}`);
      }
    } else {
      setIsLoading(false);
      setHasError(true);
      onError?.();
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  if (!src) {
    return (
      <div className={`${className} bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center`}>
        <div className="text-center text-gray-500">
          <ImageIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">No image</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`${className} bg-red-50 border-2 border-red-200 flex items-center justify-center`}>
        <div className="text-center text-red-500">
          <ImageIcon className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Image failed to load</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`${className} bg-gray-100 border-2 border-gray-200 flex items-center justify-center absolute inset-0 z-10`}>
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
};

export default function AdminGalleryPage() {
  const [galleryData, setGalleryData] = useState<GalleryItem[]>([]);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [filterYear, setFilterYear] = useState('all');
  const [filterCountry, setFilterCountry] = useState('all');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    city: '',
    year: '',
    tags: '',
    description: '',
    image: ''
  });
  const [imageFileName, setImageFileName] = useState<string>('');

  useEffect(() => {
    loadGalleryData();
  }, []);

  const loadGalleryData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gallery');
      const result = await response.json();
      
      if (result.success) {
        setGalleryData(result.data);
      } else {
        toast.error('Failed to load gallery data');
      }
    } catch (error) {
      console.error('Error loading gallery data:', error);
      toast.error('Failed to load gallery data');
    } finally {
      setLoading(false);
    }
  };

  const saveToGoogleSheets = async (action: string, data: any) => {
    try {
      const response = await fetch('/api/gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save to Google Sheets');
      }
      
      return result.data;
    } catch (error) {
      console.error('Error saving to Google Sheets:', error);
      throw error;
    }
  };

  // Add new gallery item
  const handleAdd = async () => {
    if (!formData.title || !formData.location || !formData.city || !formData.year) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const newItem = {
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      };

      const savedItem = await saveToGoogleSheets('add', newItem);
      
      // Update local state
      setGalleryData(prev => [...prev, savedItem]);
      
      resetForm();
      setIsAddingNew(false);
      toast.success('Gallery item added successfully!');
      
      // Trigger real-time update for website
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminDataUpdate', { 
          detail: { section: 'gallery', data: [...galleryData, savedItem] } 
        }));
      }
    } catch (error) {
      toast.error('Failed to add gallery item');
    } finally {
      setLoading(false);
    }
  };

  // Edit gallery item
  const handleEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      location: item.location,
      city: item.city,
      year: item.year,
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags,
      description: item.description,
      image: item.image
    });
    setImageFileName('');
  };

  // Update gallery item
  const handleUpdate = async () => {
    if (!formData.title || !formData.location || !formData.city || !formData.year) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const updatedItem = {
        ...editingItem,
        ...formData,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
      };

      const savedItem = await saveToGoogleSheets('update', updatedItem);
      
      // Update local state
      setGalleryData(prev => prev.map(item => 
        item.id === editingItem!.id ? savedItem : item
      ));

      setEditingItem(null);
      resetForm();
      toast.success('Gallery item updated successfully!');
      
      // Trigger real-time update for website
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminDataUpdate', { 
          detail: { section: 'gallery', data: galleryData.map(item => 
            item.id === editingItem!.id ? savedItem : item
          ) } 
        }));
      }
    } catch (error) {
      toast.error('Failed to update gallery item');
    } finally {
      setLoading(false);
    }
  };

  // Delete gallery item
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this gallery item?')) return;

    try {
      setLoading(true);
      await saveToGoogleSheets('delete', { id });
      
      // Update local state
      const updatedData = galleryData.filter(item => item.id !== id);
      setGalleryData(updatedData);
      
      toast.success('Gallery item deleted successfully!');
      
      // Trigger real-time update for website
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('adminDataUpdate', { 
          detail: { section: 'gallery', data: updatedData } 
        }));
      }
    } catch (error) {
      toast.error('Failed to delete gallery item');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '', location: '', city: '', year: '', tags: '', description: '', image: ''
    });
    setImageFileName('');
  };

  // Filter data
  const filteredData = galleryData.filter(item => {
    const yearMatch = filterYear === 'all' || item.year === filterYear;
    const countryMatch = filterCountry === 'all' || item.location === filterCountry;
    return yearMatch && countryMatch;
  });

  const years = [...new Set(galleryData.map(item => item.year))];
  const countries = [...new Set(galleryData.map(item => item.location))];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/admin/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                  Gallery Management
                </h1>
                <p className="text-gray-600">Manage photo gallery and media</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={loadGalleryData} variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setIsAddingNew(true)} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Add Photo
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-500 rounded-full">
                  <Camera className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-700">{galleryData.length}</div>
                  <div className="text-sm text-blue-600">Total Photos</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-500 rounded-full">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-700">{countries.length}</div>
                  <div className="text-sm text-green-600">Countries</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-500 rounded-full">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-700">{years.length}</div>
                  <div className="text-sm text-purple-600">Active Years</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-orange-500 rounded-full">
                  <Filter className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-700">{filteredData.length}</div>
                  <div className="text-sm text-orange-600">Filtered Results</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-500" />
                <span className="font-medium">Filters:</span>
              </div>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Countries</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterYear('all');
                  setFilterCountry('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData.map((item) => (
            <Card key={item.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-0">
                <div className="relative">
                  <GalleryImagePreview
                    src={item.image}
                    alt={item.title}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-white/90 text-gray-900">
                      {item.year}
                    </Badge>
                  </div>
                  <div className="absolute top-2 left-2 flex space-x-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEdit(item)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDelete(item.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center space-x-2 text-gray-600 mb-3">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">{item.city}, {item.location}</span>
                  </div>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {item.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {Array.isArray(item.tags) ? item.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    )) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <Camera className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl text-gray-600">
              No photos found matching your filters.
            </p>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isAddingNew || editingItem !== null} onOpenChange={(open) => {
          if (!open) {
            setIsAddingNew(false);
            setEditingItem(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? 'Edit Gallery Photo' : 'Add New Gallery Photo'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Photo Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Enter photo title"
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                    placeholder="Enter year"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Country *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    placeholder="Enter country"
                  />
                </div>
              </div>

              {/* Image Upload Section (local files only) */}
              <div className="space-y-2">
                <Label htmlFor="image">Gallery Image *</Label>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <Input
                      id="image-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('image/')) {
                          toast.error('Please select a valid image file');
                          return;
                        }
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error('Image size should be less than 5MB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          setFormData(prev => ({ ...prev, image: result }));
                          setImageFileName(file.name);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Upload an image (max 5MB). Only local file uploads are allowed here.
                    </p>
                    {imageFileName && (
                      <div className="mt-2 text-sm text-gray-700">
                        Selected file: <span className="font-medium">{imageFileName}</span>
                      </div>
                    )}
                  </div>
                  {formData.image && (
                    <div className="flex-shrink-0">
                      <img
                        src={formData.image}
                        alt="Image Preview"
                        width={60}
                        height={60}
                        className="rounded-lg object-cover border-2 border-gray-300"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({...formData, tags: e.target.value})}
                  placeholder="e.g. Tree Planting, Mountain Ride, Conservation"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Enter photo description"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={editingItem ? handleUpdate : handleAdd}>
                  <Save className="h-4 w-4 mr-2" />
                  {editingItem ? 'Update' : 'Add'} Photo
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
