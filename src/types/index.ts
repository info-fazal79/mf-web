export interface Book {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  is_free: boolean;
  cover_url: string;
  file_url: string;
  pages?: number;
  featured?: boolean;
  downloads_count?: number;
  created_at?: string;
}

export interface CartItem {
  book: Book;
  quantity: number;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  book_id: string;
  book?: Book;
  amount: number;
  payment_method: 'bkash' | 'nagad' | 'stripe_test' | 'free_download';
  trx_id?: string;
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  image_url: string;
  live_url?: string;
  github_url?: string;
  tags: string[];
  featured?: boolean;
  sort_order?: number;
  created_at?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  youtube_url: string;
  video_id: string;
  playlist_id?: string;
  category: string;
  duration?: string;
  views_count?: number;
  created_at?: string;
}

export interface Playlist {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  thumbnail_url?: string;
  youtube_playlist_url?: string;
  video_count?: number;
  created_at?: string;
}

export interface PlaylistVideo {
  id: string;
  playlist_id: string;
  title: string;
  youtube_url: string;
  youtube_video_id: string;
  duration?: string;
  order_index: number;
  created_at?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  category: string;
  tags: string[];
  featured_image: string;
  published: boolean;
  read_time: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_name: string;
  author_email: string;
  comment_text: string;
  is_approved: boolean;
  created_at: string;
}

export interface Consultation {
  id: string;
  name: string;
  email: string;
  service: string;
  message: string;
  status: 'new' | 'contacted' | 'completed' | 'archived';
  admin_notes?: string;
  created_at: string;
}

export interface SiteSettings {
  id?: number;
  logo_type: 'text' | 'image';
  logo_text: string;
  logo_image_url?: string;
  logo_width: number;
  hero_title: string;
  hero_bio: string;
  cv_url: string;
  contact_email: string;
  social_links: {
    facebook?: string;
    linkedin?: string;
    youtube?: string;
    github?: string;
    fiverr?: string;
  };
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}
