import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Book, 
  BlogPost, 
  CartItem, 
  Comment, 
  Consultation, 
  Order, 
  Project, 
  SiteSettings, 
  ToastNotification, 
  Tutorial 
} from '../types';
import { 
  INITIAL_BOOKS, 
  INITIAL_COMMENTS, 
  INITIAL_CONSULTATIONS, 
  INITIAL_ORDERS, 
  INITIAL_POSTS, 
  INITIAL_PROJECTS, 
  INITIAL_SITE_SETTINGS, 
  INITIAL_TUTORIALS 
} from '../lib/initialData';

interface AppState {
  // Navigation & Drawer States
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isConsultationOpen: boolean;
  setIsConsultationOpen: (open: boolean) => void;

  // Active Modals
  activeVideoId: string | null;
  setActiveVideoId: (id: string | null) => void;
  activeBlogPost: BlogPost | null;
  setActiveBlogPost: (post: BlogPost | null) => void;
  checkoutSuccessOrder: Order | null;
  setCheckoutSuccessOrder: (order: Order | null) => void;

  // Toast System
  toasts: ToastNotification[];
  addToast: (toast: { title: string; message: string; type?: 'success' | 'error' | 'info' | 'warning' }) => void;
  removeToast: (id: string) => void;

  // Cart Management
  cart: CartItem[];
  addToCart: (book: Book) => void;
  removeFromCart: (bookId: string) => void;
  updateCartQuantity: (bookId: string, quantity: number) => void;
  clearCart: () => void;

  // Admin Auth state (for demo/fallback when Supabase Auth is offline)
  isAdminAuthenticated: boolean;
  setAdminAuthenticated: (auth: boolean) => void;

  // Data Collections (Synced with Supabase or fallback LocalStorage)
  books: Book[];
  projects: Project[];
  tutorials: Tutorial[];
  posts: BlogPost[];
  comments: Comment[];
  consultations: Consultation[];
  orders: Order[];
  siteSettings: SiteSettings;

  // Entity Management Actions
  setBooks: (books: Book[]) => void;
  addBook: (book: Book) => void;
  updateBook: (id: string, book: Partial<Book>) => void;
  deleteBook: (id: string) => void;

  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, project: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  setTutorials: (tutorials: Tutorial[]) => void;
  addTutorial: (tutorial: Tutorial) => void;
  updateTutorial: (id: string, tutorial: Partial<Tutorial>) => void;
  deleteTutorial: (id: string) => void;

  setPosts: (posts: BlogPost[]) => void;
  addPost: (post: BlogPost) => void;
  updatePost: (id: string, post: Partial<BlogPost>) => void;
  deletePost: (id: string) => void;

  setComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  toggleApproveComment: (id: string) => void;
  deleteComment: (id: string) => void;

  setConsultations: (consultations: Consultation[]) => void;
  addConsultation: (consultation: Consultation) => void;
  updateConsultationStatus: (id: string, status: Consultation['status'], notes?: string) => void;
  deleteConsultation: (id: string) => void;

  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (id: string, status: Order['status']) => void;

  setSiteSettings: (settings: Partial<SiteSettings>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Drawers
      isCartOpen: false,
      setIsCartOpen: (open) => set({ isCartOpen: open }),
      isConsultationOpen: false,
      setIsConsultationOpen: (open) => set({ isConsultationOpen: open }),

      // Modals
      activeVideoId: null,
      setActiveVideoId: (id) => set({ activeVideoId: id }),
      activeBlogPost: null,
      setActiveBlogPost: (post) => set({ activeBlogPost: post }),
      checkoutSuccessOrder: null,
      setCheckoutSuccessOrder: (order) => set({ checkoutSuccessOrder: order }),

      // Toasts
      toasts: [],
      addToast: ({ title, message, type = 'success' }) => {
        const id = Math.random().toString(36).substring(2, 9);
        set((state) => ({
          toasts: [...state.toasts, { id, title, message, type }],
        }));
        setTimeout(() => {
          get().removeToast(id);
        }, 4000);
      },
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),

      // Cart
      cart: [],
      addToCart: (book) => {
        const currentCart = get().cart;
        const existing = currentCart.find((item) => item.book.id === book.id);
        if (existing) {
          get().addToast({
            title: 'Already in Cart',
            message: `"${book.title}" is already in your cart.`,
            type: 'info',
          });
          set({ isCartOpen: true });
          return;
        }
        set({
          cart: [...currentCart, { book, quantity: 1 }],
          isCartOpen: true,
        });
        get().addToast({
          title: 'Added to Cart',
          message: `"${book.title}" added to your cart.`,
          type: 'success',
        });
      },
      removeFromCart: (bookId) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.book.id !== bookId),
        }));
      },
      updateCartQuantity: (bookId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(bookId);
          return;
        }
        set((state) => ({
          cart: state.cart.map((item) =>
            item.book.id === bookId ? { ...item, quantity } : item
          ),
        }));
      },
      clearCart: () => set({ cart: [] }),

      // Admin Auth
      isAdminAuthenticated: false,
      setAdminAuthenticated: (auth) => set({ isAdminAuthenticated: auth }),

      // Data collections
      books: INITIAL_BOOKS,
      projects: INITIAL_PROJECTS,
      tutorials: INITIAL_TUTORIALS,
      posts: INITIAL_POSTS,
      comments: INITIAL_COMMENTS,
      consultations: INITIAL_CONSULTATIONS,
      orders: INITIAL_ORDERS,
      siteSettings: INITIAL_SITE_SETTINGS,

      // Book Actions
      setBooks: (books) => set({ books }),
      addBook: (book) =>
        set((state) => ({
          books: [book, ...state.books],
        })),
      updateBook: (id, bookUpdate) =>
        set((state) => ({
          books: state.books.map((b) => (b.id === id ? { ...b, ...bookUpdate } : b)),
        })),
      deleteBook: (id) =>
        set((state) => ({
          books: state.books.filter((b) => b.id !== id),
        })),

      // Project Actions
      setProjects: (projects) => set({ projects }),
      addProject: (project) =>
        set((state) => ({
          projects: [project, ...state.projects],
        })),
      updateProject: (id, projUpdate) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? { ...p, ...projUpdate } : p)),
        })),
      deleteProject: (id) =>
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
        })),

      // Tutorial Actions
      setTutorials: (tutorials) => set({ tutorials }),
      addTutorial: (tutorial) =>
        set((state) => ({
          tutorials: [tutorial, ...state.tutorials],
        })),
      updateTutorial: (id, tutUpdate) =>
        set((state) => ({
          tutorials: state.tutorials.map((t) => (t.id === id ? { ...t, ...tutUpdate } : t)),
        })),
      deleteTutorial: (id) =>
        set((state) => ({
          tutorials: state.tutorials.filter((t) => t.id !== id),
        })),

      // Post Actions
      setPosts: (posts) => set({ posts }),
      addPost: (post) =>
        set((state) => ({
          posts: [post, ...state.posts],
        })),
      updatePost: (id, postUpdate) =>
        set((state) => ({
          posts: state.posts.map((p) => (p.id === id ? { ...p, ...postUpdate } : p)),
        })),
      deletePost: (id) =>
        set((state) => ({
          posts: state.posts.filter((p) => p.id !== id),
        })),

      // Comments Actions
      setComments: (comments) => set({ comments }),
      addComment: (comment) =>
        set((state) => ({
          comments: [comment, ...state.comments],
        })),
      toggleApproveComment: (id) =>
        set((state) => ({
          comments: state.comments.map((c) =>
            c.id === id ? { ...c, is_approved: !c.is_approved } : c
          ),
        })),
      deleteComment: (id) =>
        set((state) => ({
          comments: state.comments.filter((c) => c.id !== id),
        })),

      // Consultation Actions
      setConsultations: (consultations) => set({ consultations }),
      addConsultation: (consultation) =>
        set((state) => ({
          consultations: [consultation, ...state.consultations],
        })),
      updateConsultationStatus: (id, status, notes) =>
        set((state) => ({
          consultations: state.consultations.map((c) =>
            c.id === id
              ? { ...c, status, ...(notes !== undefined ? { admin_notes: notes } : {}) }
              : c
          ),
        })),
      deleteConsultation: (id) =>
        set((state) => ({
          consultations: state.consultations.filter((c) => c.id !== id),
        })),

      // Order Actions
      setOrders: (orders) => set({ orders }),
      addOrder: (order) =>
        set((state) => ({
          orders: [order, ...state.orders],
        })),
      updateOrderStatus: (id, status) =>
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, status } : o)),
        })),

      // Site Settings
      setSiteSettings: (settingsUpdate) =>
        set((state) => ({
          siteSettings: { ...state.siteSettings, ...settingsUpdate },
        })),
    }),
    {
      name: 'fazal_portfolio_storage',
      partialize: (state) => ({
        cart: state.cart,
        isAdminAuthenticated: state.isAdminAuthenticated,
        books: state.books,
        projects: state.projects,
        tutorials: state.tutorials,
        posts: state.posts,
        comments: state.comments,
        consultations: state.consultations,
        orders: state.orders,
        siteSettings: state.siteSettings,
      }),
    }
  )
);
