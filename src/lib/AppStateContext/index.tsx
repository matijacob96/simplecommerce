"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { calculateUsdPrice, calculateArsPrice, formatUsdPrice, formatArsPrice } from "@/utils/priceUtils";

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
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parámetros de URL
  const categoryParam = searchParams.get("category") || "all";
  const searchParam = searchParams.get("search") || "";
  const availableParam = searchParams.get("available");

  // Estados
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [dolarBlue, setDolarBlue] = useState<DolarBlue | null>(null);
  const [loadingDolar, setLoadingDolar] = useState(true);
  const [defaultProfitMargin, setDefaultProfitMargin] = useState(0.2);

  // Filtros
  const [search, setSearch] = useState(searchParam);
  const [filter, setFilter] = useState(categoryParam);
  const [onlyAvailable, setOnlyAvailable] = useState(
    availableParam === null ? true : availableParam === "true"
  );

  // Debounce para búsqueda
  const debouncedSearch = useDebounce(search, 600);

  // Caché de precios
  const priceCache = useRef<Record<number, {
    usdPrice: number;
    arsPrice: number;
    formattedUsd: string;
    formattedArs: string;
  }>>({});

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
  }, [debouncedSearch, searchParam]);

  // Filtrar productos por disponibilidad
  useEffect(() => {
    if (onlyAvailable) {
      setFilteredProducts(products.filter(product => product.stock > 0));
    } else {
      setFilteredProducts(products);
    }
  }, [products, onlyAvailable]);

  // Reset del caché cuando cambian dependencias
  useEffect(() => {
    if (dolarBlue) {
      console.log("Reseteando caché de precios por cambio en dólar o categorías");
      priceCache.current = {};
    }
  }, [dolarBlue, categories, defaultProfitMargin]);

  // Cargar categorías
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (error) {
        console.error("Error al cargar categorías:", error);
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
          `/api/products?${searchParam ? 'search=' + encodeURIComponent(searchParam) + '&' : ''}filter=${encodeURIComponent(categoryParam)}`
        );
        if (response.ok) {
          const data = await response.json();
          setProducts(data);
        }
      } catch (error) {
        console.error("Error al cargar productos:", error);
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
        const response = await fetch("/api/dolar-blue");
        if (response.ok) {
          const { data } = await response.json();
          setDolarBlue(data);
        }
      } catch (error) {
        console.error("Error al cargar dólar blue:", error);
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
        console.log("Pestaña activa, recargando datos...");
        refreshData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Métodos
  const updateUrlWithFilters = useCallback((params: {
    search?: string;
    category?: string;
    available?: boolean;
  }) => {
    const newParams = new URLSearchParams(searchParams.toString());

    if (params.search !== undefined) {
      if (params.search) {
        newParams.set("search", params.search);
      } else {
        newParams.delete("search");
      }
    }

    if (params.category !== undefined) {
      if (params.category && params.category !== "all") {
        newParams.set("category", params.category);
      } else {
        newParams.delete("category");
      }
    }

    if (params.available !== undefined) {
      newParams.set("available", params.available.toString());
    }

    const newPathname = `/?${newParams.toString()}`;
    router.push(newPathname);
  }, [searchParams, router]);

  const handleSearchSubmit = () => {
    updateUrlWithFilters({ search });
  };

  const handleSearchClear = () => {
    setSearch("");
    updateUrlWithFilters({ search: "" });
  };

  const handleCategoryChange = (value: string) => {
    setFilter(value);
    updateUrlWithFilters({ category: value });
  };

  const handleAvailabilityChange = (value: boolean) => {
    setOnlyAvailable(value);
    updateUrlWithFilters({ available: value });
  };

  // Función para calcular precios
  const getPrices = useCallback((product: Product) => {
    if (!product || !dolarBlue) {
      return {
        usdPrice: 0,
        arsPrice: 0,
        formattedUsd: formatUsdPrice(0),
        formattedArs: formatArsPrice(0)
      };
    }

    if (priceCache.current[product.id]) {
      return priceCache.current[product.id];
    }

    let categoryMargin = defaultProfitMargin;
    if (product.category?.profit_margin !== undefined && product.category.profit_margin !== null) {
      categoryMargin = Number(product.category.profit_margin);
      if (isNaN(categoryMargin)) categoryMargin = defaultProfitMargin;
    }
    
    const productPrice = Number(product.price) || 0;
    const catMargin = typeof categoryMargin === 'number' && !isNaN(categoryMargin) ? categoryMargin : defaultProfitMargin;
    const defMargin = defaultProfitMargin || 0.2;
    
    const usdPrice = calculateUsdPrice(productPrice, catMargin, defMargin);
    const arsPrice = calculateArsPrice(usdPrice, dolarBlue.venta);
    
    const result = {
      usdPrice,
      arsPrice,
      formattedUsd: formatUsdPrice(usdPrice),
      formattedArs: formatArsPrice(arsPrice)
    };
    
    priceCache.current[product.id] = result;
    
    return result;
  }, [dolarBlue, defaultProfitMargin]);

  // Función para recargar todos los datos
  const refreshData = async () => {
    setLoading(true);
    
    try {
      // Cargar productos y dólar en paralelo
      await Promise.all([
        fetch(`/api/products?${searchParam ? 'search=' + encodeURIComponent(searchParam) + '&' : ''}filter=${encodeURIComponent(categoryParam)}`)
          .then(response => {
            if (!response.ok) throw new Error('Error al cargar productos');
            return response.json();
          })
          .then(data => {
            setProducts(data);
            return true;
          })
          .catch(error => {
            console.error("Error al recargar productos:", error);
            return false;
          }),
        
        fetch("/api/dolar-blue")
          .then(response => {
            if (!response.ok) throw new Error('Error al cargar dólar blue');
            return response.json();
          })
          .then(({ data }) => {
            setDolarBlue(data);
            return true;
          })
          .catch(error => {
            console.error("Error al recargar dólar blue:", error);
            return false;
          })
      ]);
    } catch (error) {
      console.error("Error al recargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  // Valor del contexto
  const value = {
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
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState debe ser usado dentro de un AppStateProvider');
  }
  return context;
} 