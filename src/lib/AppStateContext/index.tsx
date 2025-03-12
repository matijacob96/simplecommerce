'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  Suspense
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  calculateUsdPrice,
  calculateArsPrice,
  formatUsdPrice,
  formatArsPrice
} from '@/utils/priceUtils';

// Tipos
type Category = {
  id: number;
  name: string;
  profit_margin?: number | null;
};

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  image?: string;
  category_id?: number;
  category?: Category;
  flavor?: string;
};

interface DolarBlue {
  compra: number;
  venta: number;
  fromCache?: boolean;
  timestamp: number;
}

// Interfaz del contexto
interface AppStateContextType {
  // Estados
  products: Product[];
  filteredProducts: Product[];
  categories: Category[];
  loading: boolean;
  isMobile: boolean;
  dolarBlue: DolarBlue | null;
  loadingDolar: boolean;
  defaultProfitMargin: number;

  // Filtros
  search: string;
  filter: string;
  onlyAvailable: boolean;

  // Métodos
  setSearch: (value: string) => void;
  handleSearchSubmit: () => void;
  handleSearchClear: () => void;
  handleCategoryChange: (value: string) => void;
  handleAvailabilityChange: (value: boolean) => void;
  getPrices: (product: Product) => {
    usdPrice: number;
    arsPrice: number;
    formattedUsd: string;
    formattedArs: string;
  };
  refreshData: () => Promise<void>;
}

// Función de debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const AppStateContext = createContext<AppStateContextType | undefined>(
  undefined
);

// Componente interno que usa useSearchParams
function AppStateProviderContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parámetros de URL
  const categoryParam = searchParams.get('category') || 'all';
  const searchParam = searchParams.get('search') || '';
  const availableParam = searchParams.get('available');

  // Estados
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [dolarBlue, setDolarBlue] = useState<DolarBlue | null>(null);
  const [loadingDolar, setLoadingDolar] = useState(true);
  const [defaultProfitMargin] = useState(0.2);

  // Filtros
  const [search, setSearch] = useState(searchParam);
  const [filter, setFilter] = useState(categoryParam);
  const [onlyAvailable, setOnlyAvailable] = useState(
    availableParam === null ? true : availableParam === 'true'
  );

  // Debounce para búsqueda
  const debouncedSearch = useDebounce(search, 600);

  // Caché de precios
  const priceCache = useRef<
    Record<
      number,
      {
        usdPrice: number;
        arsPrice: number;
        formattedUsd: string;
        formattedArs: string;
      }
    >
  >({});

  // Métodos
  const updateUrlWithFilters = useCallback(
    (params: { search?: string; category?: string; available?: boolean }) => {
      const newParams = new URLSearchParams(searchParams.toString());

      if (params.search !== undefined) {
        if (params.search) {
          newParams.set('search', params.search);
        } else {
          newParams.delete('search');
        }
      }

      if (params.category !== undefined) {
        if (params.category && params.category !== 'all') {
          newParams.set('category', params.category);
        } else {
          newParams.delete('category');
        }
      }

      if (params.available !== undefined) {
        newParams.set('available', params.available.toString());
      }

      const newPathname = `/?${newParams.toString()}`;
      router.push(newPathname);
    },
    [searchParams, router]
  );

  // Método para refrescar datos
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);

      // Cargar categorías
      const catResponse = await fetch('/api/categories');
      if (catResponse.ok) {
        const catData = await catResponse.json();
        setCategories(catData);
      }

      // Cargar productos
      const prodResponse = await fetch(
        `/api/products?${
          searchParam ? 'search=' + encodeURIComponent(searchParam) + '&' : ''
        }filter=${encodeURIComponent(filter)}`
      );
      if (prodResponse.ok) {
        const prodData = await prodResponse.json();
        setProducts(prodData);
      }

      // Cargar dólar blue
      const dolarResponse = await fetch('/api/dolar-blue');
      if (dolarResponse.ok) {
        const { data } = await dolarResponse.json();
        setDolarBlue(data);
      }

      // Resetear caché
      priceCache.current = {};
    } catch (error) {
      console.error('Error al refrescar datos:', error);
    } finally {
      setLoading(false);
    }
  }, [
    searchParam,
    filter,
    setCategories,
    setProducts,
    setDolarBlue,
    setLoading,
    priceCache
  ]);

  // Detectar tamaño de pantalla
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 576);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Actualizar URL cuando cambie el valor de búsqueda debounceado
  useEffect(() => {
    if (debouncedSearch !== searchParam) {
      updateUrlWithFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, searchParam, updateUrlWithFilters]);

  // Filtrar productos por disponibilidad
  useEffect(() => {
    if (onlyAvailable) {
      setFilteredProducts(products.filter((product) => product.stock > 0));
    } else {
      setFilteredProducts(products);
    }
  }, [products, onlyAvailable]);

  // Reset del caché cuando cambian dependencias
  useEffect(() => {
    if (dolarBlue) {
      priceCache.current = {};
    }
  }, [dolarBlue, categories, defaultProfitMargin]);

  // Cargar categorías
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error('Error al cargar categorías:', error);
      }
    };

    fetchCategories();
  }, []);

  // Cargar productos
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/products?${
            searchParam ? 'search=' + encodeURIComponent(searchParam) + '&' : ''
          }filter=${encodeURIComponent(categoryParam)}`
        );
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } catch (error) {
        console.error('Error al cargar productos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [searchParam, categoryParam]);

  // Cargar dólar blue
  useEffect(() => {
    const fetchDolarBlue = async () => {
      try {
        setLoadingDolar(true);
        const response = await fetch('/api/dolar-blue');
        if (response.ok) {
          const { data } = await response.json();
          setDolarBlue(data);
        }
      } catch (error) {
        console.error('Error al cargar dólar blue:', error);
      } finally {
        setLoadingDolar(false);
      }
    };

    fetchDolarBlue();
    const interval = setInterval(fetchDolarBlue, 1000 * 60 * 60); // Actualizar cada hora

    return () => clearInterval(interval);
  }, []);

  // Manejar cambios de visibilidad (cambio de pestaña)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshData]);

  // Método para buscar
  const handleSearchSubmit = () => {
    updateUrlWithFilters({ search });
  };

  // Método para limpiar búsqueda
  const handleSearchClear = () => {
    setSearch('');
    updateUrlWithFilters({ search: '' });
  };

  // Método para cambiar categoría
  const handleCategoryChange = (value: string) => {
    setFilter(value);
    updateUrlWithFilters({ category: value });
  };

  // Método para cambiar disponibilidad
  const handleAvailabilityChange = (value: boolean) => {
    setOnlyAvailable(value);
    updateUrlWithFilters({ available: value });
  };

  // Método para obtener precios
  const getPrices = useCallback(
    ((product: Product) => {
      // Usar caché si existe
      if (priceCache.current[product.id]) {
        return priceCache.current[product.id];
      }

      // Si no hay dólar o categorías, devolver valores predeterminados
      if (!dolarBlue || !categories.length) {
        return {
          usdPrice: product.price,
          arsPrice: product.price * 1000,
          formattedUsd: formatUsdPrice(product.price),
          formattedArs: formatArsPrice(product.price * 1000)
        };
      }

      // Obtener margen de ganancia
      let profitMargin = defaultProfitMargin;
      if (
        product.category &&
        product.category.profit_margin !== null &&
        product.category.profit_margin !== undefined
      ) {
        profitMargin = product.category.profit_margin;
      } else {
        const category = categories.find((c) => c.id === product.category_id);
        if (
          category &&
          category.profit_margin !== null &&
          category.profit_margin !== undefined
        ) {
          profitMargin = category.profit_margin;
        }
      }

      // Calcular precios
      const usdPrice = calculateUsdPrice(product.price, profitMargin);
      const arsPrice = calculateArsPrice(usdPrice, dolarBlue.venta);

      // Formatear precios
      const result = {
        usdPrice,
        arsPrice,
        formattedUsd: formatUsdPrice(usdPrice),
        formattedArs: formatArsPrice(arsPrice)
      };

      // Guardar en caché
      priceCache.current[product.id] = result;

      return result;
    }) as (product: Product) => {
      usdPrice: number;
      arsPrice: number;
      formattedUsd: string;
      formattedArs: string;
    },
    [dolarBlue, categories, defaultProfitMargin]
  );

  const contextValue: AppStateContextType = {
    // Estados
    products,
    filteredProducts,
    categories,
    loading,
    isMobile,
    dolarBlue,
    loadingDolar,
    defaultProfitMargin,

    // Filtros
    search,
    filter,
    onlyAvailable,

    // Métodos
    setSearch,
    handleSearchSubmit,
    handleSearchClear,
    handleCategoryChange,
    handleAvailabilityChange,
    getPrices,
    refreshData
  };

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
}

// Componente principal con Suspense boundary
export function AppStateProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div>Cargando estado de la aplicación...</div>}>
      <AppStateProviderContent>{children}</AppStateProviderContent>
    </Suspense>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState debe usarse dentro de un AppStateProvider');
  }
  return context;
}
