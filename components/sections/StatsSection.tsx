'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TreePine, Users, Globe, Calendar, Bike } from 'lucide-react';

export function StatsSection() {
  const [stats, setStats] = useState({
    trees: 25847,
    riders: 52340,
    countries: 156,
    events: 543
  });
  const [treeCount, setTreeCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [counters, setCounters] = useState([0, 0, 0, 0]);

  const fetchTreeCount = async () => {
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      
      if (result.success && result.data.treeCount) {
        setTargetCount(result.data.treeCount.count);
      }
    } catch (error) {
      console.error('Error fetching tree count:', error);
      // Fallback to default value
      setTargetCount(25847);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchTreeCount();

    // Set up polling for real-time updates every 30 seconds
    const pollInterval = setInterval(fetchTreeCount, 30000);

    // Listen for custom events from admin updates
    const handleAdminUpdate = (event: CustomEvent) => {
      if (event.detail.section === 'treeCount') {
        setTargetCount(event.detail.data);
      }
    };

    window.addEventListener('adminDataUpdate', handleAdminUpdate as EventListener);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('adminDataUpdate', handleAdminUpdate as EventListener);
    };
  }, []);

  useEffect(() => {
    if (targetCount === 0) return;

    // Animate counter when target changes
    const timer = setInterval(() => {
      setTreeCount(prev => {
        if (prev < targetCount) {
          const increment = Math.max(Math.floor(targetCount / 1000 *23), 50);
          return Math.min(prev + increment, targetCount);
        }
        return targetCount;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [targetCount]);

  const statsData = [
    {
      icon: TreePine,
      value: treeCount.toLocaleString(),
      label: 'Trees Planted',
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconBg: 'bg-green-500',
    },
    {
      icon: Users,
      value: 52430,
      label: 'Global Riders',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconBg: 'bg-blue-500',
    },
    {
      icon: Globe,
      value: 25,
      label: 'Countries',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      iconBg: 'bg-purple-500',
    },
    {
      icon: Calendar,
      value: 160,
      label: 'Events Organized',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      iconBg: 'bg-orange-500',
    },
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            {/* <Bike className="h-8 w-8 text-primary animate-bounce" /> */}
            <h2 className="text-4xl font-bold text-foreground">
              Our Global Impact
            </h2>
            {/* <Bike className="h-8 w-8 text-blue-600 animate-bounce" style={{ animationDelay: '0.5s' }} /> */}
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Together, we're making a difference across the globe. Every ride counts, every tree matters.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {statsData.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Card key={index} className="card-hover border-0 shadow-lg">
                <CardContent className="p-8 text-center">
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${stat.bgColor} mb-6 relative`}>
                    <div className={`p-3 ${stat.iconBg} rounded-full`}>
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    {/* {index === 0 && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                    )} */}
                  </div>
                  <div className="text-4xl font-bold text-foreground mb-2">
                    {stat.value.toLocaleString()}
                  </div>
                  <div className="text-muted-foreground font-medium">
                    {stat.label}
                  </div>
                  {index === 0 && (
                    <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                      {/* Live count updated by admin */}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Enhanced Call to Action */}
        <div className="mt-16 text-center">
          <div className="bg-background/10 dark:bg-gray-800/100 backdrop-blur-md rounded-2xl p-8 text-gray-900 dark:text-white">
            <div className="flex items-center justify-center space-x-4 mb-4">
              {/* <Bike className="h-10 w-10 animate-bounce" /> */}
              <h3 className="text-2xl font-bold">Join the Movement</h3>
              {/* <Bike className="h-10 w-10 animate-bounce" style={{ animationDelay: '0.5s' }} /> */}
            </div>
            <p className="text-lg text-green-400 dark:text-blue-300  mb-6">
              Be part of these growing numbers. Every rider makes a difference!
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <TreePine className="h-4 w-4" />
                <span>Plant trees while riding</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Connect with global riders</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>Make worldwide impact</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}