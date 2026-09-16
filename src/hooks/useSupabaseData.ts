import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { Book, BlogPost, Project, Tutorial, Comment, Consultation, Order, SiteSettings } from '../types';

export function useSupabaseData() {
  const [isLoading, setIsLoading] = useState(true);
  const isConnected = isSupabaseConfigured();

  const {
    setBooks,
    setProjects,
    setTutorials,
    setPosts,
    setComments,
    setConsultations,
    setOrders,
    setSiteSettings,
  } = useStore();

  useEffect(() => {
    async function syncData() {
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Fetch Books
        const { data: booksData } = await supabase
          .from('books')
          .select('*')
          .order('created_at', { ascending: false });
        if (booksData && booksData.length > 0) setBooks(booksData as Book[]);

        // Fetch Projects
        const { data: projectsData } = await supabase
          .from('projects')
          .select('*')
          .order('sort_order', { ascending: true });
        if (projectsData && projectsData.length > 0) setProjects(projectsData as Project[]);

        // Fetch Tutorials
        const { data: tutsData } = await supabase
          .from('tutorials')
          .select('*')
          .order('created_at', { ascending: false });
        if (tutsData && tutsData.length > 0) setTutorials(tutsData as Tutorial[]);

        // Fetch Posts
        const { data: postsData } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        if (postsData && postsData.length > 0) setPosts(postsData as BlogPost[]);

        // Fetch Comments
        const { data: commentsData } = await supabase
          .from('comments')
          .select('*')
          .order('created_at', { ascending: false });
        if (commentsData && commentsData.length > 0) setComments(commentsData as Comment[]);

        // Fetch Consultations
        const { data: consultData } = await supabase
          .from('consultations')
          .select('*')
          .order('created_at', { ascending: false });
        if (consultData && consultData.length > 0) setConsultations(consultData as Consultation[]);

        // Fetch Orders
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*, book:books(*)')
          .order('created_at', { ascending: false });
        if (ordersData && ordersData.length > 0) setOrders(ordersData as Order[]);

        // Fetch Site Settings
        const { data: settingsData } = await supabase
          .from('site_settings')
          .select('*')
          .eq('id', 1)
          .single();
        if (settingsData) setSiteSettings(settingsData as SiteSettings);

      } catch (error) {
        console.warn('Supabase sync encountered an error, running in local fallback mode:', error);
      } finally {
        setIsLoading(false);
      }
    }

    syncData();
  }, [isConnected, setBooks, setProjects, setTutorials, setPosts, setComments, setConsultations, setOrders, setSiteSettings]);

  return { isLoading, isConnected };
}
