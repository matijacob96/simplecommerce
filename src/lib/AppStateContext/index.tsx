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
import { Spin } from 'antd';

// Tipos
type Category = {
  id: number;
  name: string;
  profit_margin?: number | null;
};

export type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  image?: string;
  category_id?: number;
  category?: Category;
  flavor?: string;
};

// Tipo para opciones de ordenamiento
type SortOption =
  | 'default'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'name_desc';

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
  sortBy: SortOption;

  // Métodos
  setSearch: (value: string) => void;
  handleSearchSubmit: () => void;
  handleSearchClear: () => void;
  handleCategoryChange: (value: string) => void;
  handleAvailabilityChange: (value: boolean) => void;
  handleSortChange: (value: SortOption) => void;
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
  const sortParam = (searchParams.get('sort') as SortOption) || 'default';

  // Referencia para saber si el componente está montado
  const isMounted = useRef(true);

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
  const [sortBy, setSortBy] = useState<SortOption>(sortParam);

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
    (params: {
      search?: string;
      category?: string;
      available?: boolean;
      sort?: SortOption;
    }) => {
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

      if (params.sort !== undefined) {
        if (params.sort && params.sort !== 'default') {
          newParams.set('sort', params.sort);
        } else {
          newParams.delete('sort');
        }
      }

      const newPathname = `/?${newParams.toString()}`;
      router.push(newPathname);
    },
    [searchParams, router]
  );

  // Método para refrescar datos
  const refreshData = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      setLoading(true);

      // Cargar categorías
      const catResponse = await fetch('/api/categories');
      if (catResponse.ok && isMounted.current) {
        const catData = await catResponse.json();
        setCategories(catData || []);
      } else {
        console.error(
          'Respuesta no OK al cargar categorías:',
          catResponse.status
        );
      }

      // Cargar productos
      const queryParams = new URLSearchParams();

      if (searchParam) {
        queryParams.set('search', searchParam);
      }

      queryParams.set('filter', filter);

      const prodResponse = await fetch(
        `/api/products?${queryParams.toString()}`
      );

      if (prodResponse.ok && isMounted.current) {
        const prodData = await prodResponse.json();
        setProducts(prodData || []);
      } else {
        console.error(
          'Respuesta no OK al cargar productos:',
          prodResponse.status
        );
        if (isMounted.current) {
          setProducts([]);
        }
      }

      // Cargar dólar blue
      const dolarResponse = await fetch('/api/dolar-blue');
      if (dolarResponse.ok && isMounted.current) {
        const { data } = await dolarResponse.json();
        setDolarBlue(data);
      }

      // Resetear caché
      if (isMounted.current) {
        priceCache.current = {};
      }
    } catch (error) {
      console.error('Error al refrescar datos:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [
    searchParam,
    filter,
    setCategories,
    setProducts,
    setDolarBlue,
    setLoading,
    priceCache,
    isMounted
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
    if (!isMounted.current) return;

    try {
      if (dolarBlue) {
        priceCache.current = {};
      }
    } catch (error) {
      console.error('Error al resetear caché de precios:', error);
    }
  }, [dolarBlue, categories, defaultProfitMargin]);

  // Cargar categorías
  useEffect(() => {
    const fetchCategories = async () => {
      if (!isMounted.current) return;

      try {
        setLoading(true);
        const response = await fetch('/api/categories');
        if (response.ok && isMounted.current) {
          const data = await response.json();
          setCategories(data || []);
        } else {
          console.error(
            'Respuesta no OK al cargar categorías:',
            response.status
          );
        }
      } catch (error) {
        console.error('Error al cargar categorías:', error);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchCategories();
  }, []);

  // Cargar productos
  useEffect(() => {
    const fetchProducts = async () => {
      if (!isMounted.current) return;

      setLoading(true);
      try {
        const queryParams = new URLSearchParams();

        if (searchParam) {
          queryParams.set('search', searchParam);
        }

        queryParams.set('filter', categoryParam);

        const response = await fetch(`/api/products?${queryParams.toString()}`);

        if (response.ok && isMounted.current) {
          const data = await response.json();
          setProducts(data || []);
        } else {
          console.error(
            'Respuesta no OK al cargar productos:',
            response.status
          );
          if (isMounted.current) {
            setProducts([]);
          }
        }
      } catch (error) {
        console.error('Error al cargar productos:', error);
        if (isMounted.current) {
          setProducts([]);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchProducts();
  }, [searchParam, categoryParam]);

  // Cargar dólar blue
  useEffect(() => {
    const fetchDolarBlue = async () => {
      if (!isMounted.current) return;

      try {
        setLoadingDolar(true);
        const response = await fetch('/api/dolar-blue');
        if (response.ok && isMounted.current) {
          const { data } = await response.json();
          setDolarBlue(data);
        }
      } catch (error) {
        console.error('Error al cargar dólar blue:', error);
      } finally {
        if (isMounted.current) {
          setLoadingDolar(false);
        }
      }
    };

    fetchDolarBlue();
    const interval = setInterval(() => {
      if (isMounted.current) {
        fetchDolarBlue();
      }
    }, 1000 * 60 * 60); // Actualizar cada hora

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
  const handleSearchSubmit = useCallback(() => {
    if (!isMounted.current) return;
    updateUrlWithFilters({ search });
  }, [search, updateUrlWithFilters]);

  // Método para limpiar búsqueda
  const handleSearchClear = useCallback(() => {
    if (!isMounted.current) return;
    setSearch('');
    updateUrlWithFilters({ search: '' });
  }, [updateUrlWithFilters]);

  // Método para cambiar categoría
  const handleCategoryChange = useCallback(
    (value: string) => {
      if (!isMounted.current) return;

      try {
        // Primero actualizamos el estado local
        setFilter(value);

        // Realizar una limpieza preventiva del caché durante cambios de categoría
        // para garantizar precios frescos con la nueva categoría
        priceCache.current = {};

        // Usamos setTimeout para asegurar que la actualización de URL
        // ocurra después de que React haya actualizado el DOM,
        // evitando problemas de sincronización
        setTimeout(() => {
          if (isMounted.current) {
            updateUrlWithFilters({ category: value });
          }
        }, 0);
      } catch (error) {
        console.error('Error al cambiar categoría:', error);
      }
    },
    [updateUrlWithFilters]
  );

  // Método para cambiar disponibilidad
  const handleAvailabilityChange = useCallback(
    (value: boolean) => {
      if (!isMounted.current) return;
      setOnlyAvailable(value);
      updateUrlWithFilters({ available: value });
    },
    [updateUrlWithFilters]
  );

  // Método para cambiar ordenamiento
  const handleSortChange = useCallback(
    (value: SortOption) => {
      if (!isMounted.current) return;

      // Primero actualizamos el estado local
      setSortBy(value);

      // Usamos setTimeout para evitar problemas de sincronización
      setTimeout(() => {
        if (isMounted.current) {
          updateUrlWithFilters({ sort: value });
        }
      }, 0);
    },
    [updateUrlWithFilters]
  );

  // Método para obtener precios
  const getPrices = useCallback(
    ((product: Product) => {
      // Verificación básica de producto
      if (!product) {
        console.warn(
          'Se intentó obtener precios de un producto nulo o indefinido'
        );
        return {
          usdPrice: 0,
          arsPrice: 0,
          formattedUsd: formatUsdPrice(0),
          formattedArs: formatArsPrice(0)
        };
      }

      try {
        // Usar caché si existe
        if (priceCache.current && priceCache.current[product.id]) {
          return priceCache.current[product.id];
        }

        // Asegurar que el precio base sea un número
        const basePrice =
          typeof product.price === 'number'
            ? product.price
            : typeof product.price === 'string'
            ? parseFloat(product.price)
            : 0;

        // Si no hay dólar o categorías, usar cálculo simplificado
        if (!dolarBlue || !categories.length) {
          return {
            usdPrice: basePrice,
            arsPrice: basePrice * 1000,
            formattedUsd: formatUsdPrice(basePrice),
            formattedArs: formatArsPrice(basePrice * 1000)
          };
        }

        // Obtener margen de ganancia
        let profitMargin = defaultProfitMargin;

        // Intentar obtener el margen de la categoría del producto
        if (
          product.category &&
          product.category.profit_margin !== null &&
          product.category.profit_margin !== undefined
        ) {
          profitMargin =
            typeof product.category.profit_margin === 'number'
              ? product.category.profit_margin
              : parseFloat(String(product.category.profit_margin));
        } else if (product.category_id) {
          // Buscar la categoría si solo tenemos el ID
          const category = categories.find((c) => c.id === product.category_id);
          if (
            category &&
            category.profit_margin !== null &&
            category.profit_margin !== undefined
          ) {
            profitMargin =
              typeof category.profit_margin === 'number'
                ? category.profit_margin
                : parseFloat(String(category.profit_margin));
          }
        }

        // Asegurar que el tipo de cambio sea un número
        const exchangeRate =
          typeof dolarBlue.venta === 'number'
            ? dolarBlue.venta
            : typeof dolarBlue.venta === 'string'
            ? parseFloat(dolarBlue.venta)
            : 1000;

        // Calcular precios
        const usdPrice = calculateUsdPrice(basePrice, profitMargin);
        const arsPrice = calculateArsPrice(usdPrice, exchangeRate);

        // Formatear precios
        const result = {
          usdPrice,
          arsPrice,
          formattedUsd: formatUsdPrice(usdPrice),
          formattedArs: formatArsPrice(arsPrice)
        };

        // Guardar en caché
        if (priceCache.current) {
          priceCache.current[product.id] = result;
        }

        return result;
      } catch (error) {
        console.error(
          'Error al calcular precios para producto:',
          product.id,
          error
        );

        // En caso de error, usar el precio base directamente
        const fallbackPrice = product.price || 0;
        return {
          usdPrice: fallbackPrice,
          arsPrice: fallbackPrice * 1000,
          formattedUsd: formatUsdPrice(fallbackPrice),
          formattedArs: formatArsPrice(fallbackPrice * 1000)
        };
      }
    }) as (product: Product) => {
      usdPrice: number;
      arsPrice: number;
      formattedUsd: string;
      formattedArs: string;
    },
    [dolarBlue, categories, defaultProfitMargin]
  );

  // Function to sort products by the selected criteria
  const sortProducts = useCallback(
    (productsToSort: Product[]) => {
      if (!productsToSort || !productsToSort.length) {
        return [];
      }

      try {
        // Filtrar productos nulos o indefinidos para evitar errores
        const validProducts = productsToSort.filter((p) => p != null);

        // Si no hay productos válidos, devolver array vacío
        if (!validProducts.length) {
          return [];
        }

        // Clonar para no modificar el original
        const sortedProducts = [...validProducts];

        // Ordenar según criterio seleccionado
        switch (sortBy) {
          case 'price_asc':
            return sortedProducts.sort((a, b) => {
              try {
                // Usamos getPrices de forma segura
                const pricesA = getPrices(a);
                const pricesB = getPrices(b);
                return pricesA.arsPrice - pricesB.arsPrice;
              } catch (e) {
                console.error('Error comparando precios ASC:', e);
                // Si hay error, comparar por precio base
                return (a.price || 0) - (b.price || 0);
              }
            });

          case 'price_desc':
            return sortedProducts.sort((a, b) => {
              try {
                const pricesA = getPrices(a);
                const pricesB = getPrices(b);
                return pricesB.arsPrice - pricesA.arsPrice;
              } catch (e) {
                console.error('Error comparando precios DESC:', e);
                return (b.price || 0) - (a.price || 0);
              }
            });

          case 'name_asc':
            return sortedProducts.sort((a, b) => {
              try {
                return (a.name || '').localeCompare(b.name || '');
              } catch (e) {
                console.error('Error comparando nombres ASC:', e);
                return 0;
              }
            });

          case 'name_desc':
            return sortedProducts.sort((a, b) => {
              try {
                return (b.name || '').localeCompare(a.name || '');
              } catch (e) {
                console.error('Error comparando nombres DESC:', e);
                return 0;
              }
            });

          default:
            return sortedProducts;
        }
      } catch (error) {
        console.error('Error en sortProducts:', error);
        return productsToSort; // Devolver productos originales en caso de error
      }
    },
    [sortBy, getPrices]
  );

  // Filtrar productos por disponibilidad y ordenarlos
  useEffect(() => {
    if (!isMounted.current) return;

    // Creamos una función que se ejecutará de forma segura
    const updateFilteredProducts = () => {
      if (!isMounted.current) return;

      try {
        let filtered = [...products];

        // Asegurarse de que todos los productos son válidos
        filtered = filtered.filter(
          (product) => product !== null && product !== undefined
        );

        // Filtrar por disponibilidad
        if (onlyAvailable) {
          filtered = filtered.filter((product) => product.stock > 0);
        }

        // Aplicar ordenamiento
        try {
          filtered = sortProducts(filtered);
        } catch (error) {
          console.error('Error al ordenar productos:', error);
        }

        if (isMounted.current) {
          setFilteredProducts(filtered);
        }
      } catch (error) {
        console.error('Error al filtrar productos:', error);
        // En caso de error, al menos asegurar que se muestra algo
        if (isMounted.current && products.length > 0) {
          setFilteredProducts(products);
        }
      }
    };

    // Usamos un pequeño timeout para asegurar que este efecto
    // no colisione con otras actualizaciones de estado
    const timerId = setTimeout(updateFilteredProducts, 0);

    return () => {
      clearTimeout(timerId);
    };
  }, [products, onlyAvailable, sortBy, sortProducts]);

  // Actualizar URL cuando cambie el valor de ordenamiento
  useEffect(() => {
    if (!isMounted.current) return;

    if (sortBy !== sortParam) {
      const timerId = setTimeout(() => {
        if (isMounted.current) {
          updateUrlWithFilters({ sort: sortBy });
        }
      }, 0);

      return () => {
        clearTimeout(timerId);
      };
    }
  }, [sortBy, sortParam, updateUrlWithFilters]);

  // Asegurar que no se actualice el estado después de desmontado
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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
    sortBy,

    // Métodos
    setSearch,
    handleSearchSubmit,
    handleSearchClear,
    handleCategoryChange,
    handleAvailabilityChange,
    handleSortChange,
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
    <Suspense fallback={<Spin size="large" fullscreen />}>
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
