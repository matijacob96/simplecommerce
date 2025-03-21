'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  Suspense,
} from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  calculateUsdPrice,
  calculateArsPrice,
  formatUsdPrice,
  formatArsPrice,
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
type SortOption = 'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

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
    isValid: boolean;
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

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

// Componente interno que usa useSearchParams
function AppStateProviderContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Parámetros de URL (ahora solo para inicialización inicial)
  const categoryParam = searchParams.get('category') || 'all';
  const searchParam = searchParams.get('search') || '';
  const availableParam = searchParams.get('available');
  const sortParam = (searchParams.get('sort') as SortOption) || 'default';

  // Referencia para saber si el componente está montado
  const isMounted = useRef(true);

  // Referencia para controlar la inicialización
  const isInitialized = useRef(false);

  // Estados
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [dolarBlue, setDolarBlue] = useState<DolarBlue | null>(null);
  const [loadingDolar, setLoadingDolar] = useState(true);
  const [defaultProfitMargin] = useState(0.2);

  // Filtros (inicializados una vez desde URL o con valores por defecto)
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

  // Nueva función para aplicar los filtros a la URL cuando estamos en la página del catálogo
  const applyFiltersToUrl = useCallback(() => {
    // Solo aplicar cuando estamos en la página principal (catálogo)
    if (pathname !== '/' && pathname !== '') {
      return;
    }

    const newParams = new URLSearchParams();

    // Aplicar búsqueda si existe
    if (search) {
      newParams.set('search', search);
    }

    // Aplicar categoría si no es 'all'
    if (filter && filter !== 'all') {
      newParams.set('category', filter);
    }

    // Aplicar disponibilidad SOLO si es false (no mostramos el valor por defecto true)
    if (!onlyAvailable) {
      newParams.set('available', 'false');
    }

    // Aplicar ordenamiento si no es el default
    if (sortBy && sortBy !== 'default') {
      newParams.set('sort', sortBy);
    }

    // Construir la nueva URL y navegación sin recargar
    const newPathname = `/?${newParams.toString()}`;

    // Usar router.push en lugar de history.replaceState para asegurar
    // una actualización de URL más consistente
    router.push(newPathname, { scroll: false });
  }, [pathname, search, filter, onlyAvailable, sortBy, router]);

  // Aplicar filtros a la URL cuando cambiamos a la página principal
  useEffect(() => {
    if (!isMounted.current || !isInitialized.current) return;

    // Si estamos en la página principal, aplicar los filtros a la URL
    if (pathname === '/' || pathname === '') {
      applyFiltersToUrl();
    }
  }, [pathname, applyFiltersToUrl]);

  // Inicialización completa
  useEffect(() => {
    isInitialized.current = true;
  }, []);

  // Actualizar URL cuando cambie el valor de búsqueda debounceado
  useEffect(() => {
    if (!isMounted.current || !isInitialized.current) return;

    // Solo si estamos en la página principal y el valor ha cambiado
    if (pathname === '/' || pathname === '') {
      // Aplicar los filtros inmediatamente
      applyFiltersToUrl();
    }
  }, [debouncedSearch, pathname, applyFiltersToUrl]);

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
    if (!isMounted.current) return;

    try {
      // Limpiamos la caché cada vez que cambian factores que afectan el cálculo de precios
      if (dolarBlue || categories.length > 0) {
        console.log('Invaliding price cache due to changes in dolar or categories');
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
          console.error('Respuesta no OK al cargar categorías:', response.status);
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

        // Asegurar que el filtro de categoría se aplique correctamente
        if (categoryParam && categoryParam !== 'all') {
          queryParams.set('filter', categoryParam);
        } else {
          queryParams.set('filter', 'all');
        }

        const response = await fetch(`/api/products?${queryParams.toString()}`);

        if (response.ok && isMounted.current) {
          const data = await response.json();
          setProducts(data || []);

          // Log para depuración
          console.log(`Productos cargados con filtro: ${categoryParam}`, data.length);
        } else {
          console.error('Respuesta no OK al cargar productos:', response.status);
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
    const interval = setInterval(
      () => {
        if (isMounted.current) {
          fetchDolarBlue();
        }
      },
      1000 * 60 * 5
    ); // Actualizar cada 5 minutos

    return () => clearInterval(interval);
  }, []);

  // Manejar cambios de visibilidad (cambio de pestaña)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMounted.current) {
        // En lugar de llamar a refreshData directamente, llamamos
        // a las funciones individuales necesarias para evitar la referencia circular
        setLoading(true);

        // Cargar productos y categorías
        fetch('/api/categories')
          .then(response => (response.ok ? response.json() : []))
          .then(data => {
            if (isMounted.current) {
              setCategories(data || []);
            }
          })
          .catch(error => console.error('Error al cargar categorías:', error));

        // Cargar dólar blue
        fetch('/api/dolar-blue')
          .then(response => (response.ok ? response.json() : null))
          .then(responseData => {
            if (isMounted.current && responseData) {
              setDolarBlue(responseData.data);
            }
          })
          .catch(error => console.error('Error al cargar dólar blue:', error))
          .finally(() => {
            if (isMounted.current) {
              setLoading(false);
            }
          });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Método para buscar
  const handleSearchSubmit = useCallback(() => {
    if (!isMounted.current) return;

    // En la página principal, actualizar la URL
    if (pathname === '/' || pathname === '') {
      applyFiltersToUrl();
    }
  }, [pathname, applyFiltersToUrl]);

  // Método para limpiar búsqueda
  const handleSearchClear = useCallback(() => {
    if (!isMounted.current) return;

    // Actualizar estado
    setSearch('');

    // En la página principal, actualizar la URL
    if (pathname === '/' || pathname === '') {
      // Aplicar los filtros inmediatamente
      applyFiltersToUrl();
    }
  }, [pathname, applyFiltersToUrl]);

  // Método para cambiar categoría
  const handleCategoryChange = useCallback(
    (value: string) => {
      if (!isMounted.current) return;

      try {
        // Primero actualizamos el estado local
        setFilter(value);

        // Actualizar la URL inmediatamente
        if (pathname === '/' || pathname === '') {
          applyFiltersToUrl();
        }

        // Realizar una limpieza preventiva del caché durante cambios de categoría
        // para garantizar precios frescos con la nueva categoría
        priceCache.current = {};

        // Actualizar la carga de productos con la nueva categoría
        setLoading(true);

        // Crear función asíncrona para cargar productos filtrados por la nueva categoría
        const fetchFilteredProducts = async () => {
          if (!isMounted.current) return;

          try {
            const queryParams = new URLSearchParams();

            if (search) {
              queryParams.set('search', search);
            }

            queryParams.set('filter', value);

            const response = await fetch(`/api/products?${queryParams.toString()}`);

            if (response.ok && isMounted.current) {
              const data = await response.json();
              setProducts(data || []);

              // Log para depuración
              console.log(`Productos filtrados por categoría: ${value}`, data.length);
            } else {
              console.error('Respuesta no OK al cargar productos filtrados:', response.status);
              if (isMounted.current) {
                setProducts([]);
              }
            }
          } catch (error) {
            console.error('Error al cargar productos filtrados:', error);
            if (isMounted.current) {
              setProducts([]);
            }
          } finally {
            if (isMounted.current) {
              setLoading(false);
            }
          }
        };

        // Ejecutar la carga de productos
        fetchFilteredProducts();
      } catch (error) {
        console.error('Error al cambiar categoría:', error);
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [search, setProducts, setLoading, pathname, applyFiltersToUrl]
  );

  // Método para cambiar disponibilidad
  const handleAvailabilityChange = useCallback(
    (value: boolean) => {
      if (!isMounted.current) return;

      // Actualizar estado
      setOnlyAvailable(value);

      // Actualizar URL inmediatamente si estamos en la página principal
      if (pathname === '/' || pathname === '') {
        // Aplicar el cambio inmediatamente
        applyFiltersToUrl();
      }
    },
    [pathname, applyFiltersToUrl]
  );

  // Método para cambiar ordenamiento
  const handleSortChange = useCallback(
    (value: SortOption) => {
      if (!isMounted.current) return;

      // Actualizar estado
      setSortBy(value);

      // Log para depuración
      console.log(`Cambiando ordenamiento a: ${value}`);

      // Actualizar URL inmediatamente si estamos en la página principal
      if (pathname === '/' || pathname === '') {
        // Aplicar el cambio inmediatamente
        applyFiltersToUrl();
      }
    },
    [pathname, applyFiltersToUrl]
  );

  // Método para obtener precios
  const getPrices = useCallback(
    ((product: Product) => {
      // Verificación básica de producto
      if (!product) {
        console.warn('Se intentó obtener precios de un producto nulo o indefinido');
        return {
          usdPrice: 0,
          arsPrice: 0,
          formattedUsd: formatUsdPrice(0),
          formattedArs: formatArsPrice(0),
          isValid: false,
        };
      }

      try {
        // Verificar si tenemos toda la información necesaria para un cálculo preciso
        const hasValidDolarBlue =
          dolarBlue && typeof dolarBlue.venta === 'number' && dolarBlue.venta > 0;

        // Asegurar que el precio base sea un número válido
        const basePrice =
          typeof product.price === 'number' && !isNaN(product.price) && product.price > 0
            ? product.price
            : typeof product.price === 'string'
              ? parseFloat(product.price)
              : 0;

        // Si el precio base no es válido, retornar con indicador de invalidez
        if (basePrice <= 0) {
          console.warn('Precio base inválido para producto:', product.id, product.name);
          return {
            usdPrice: 0,
            arsPrice: 0,
            formattedUsd: formatUsdPrice(0),
            formattedArs: formatArsPrice(0),
            isValid: false,
          };
        }

        // Usar caché solo si el dólar blue es válido
        if (hasValidDolarBlue && priceCache.current && priceCache.current[product.id]) {
          return {
            ...priceCache.current[product.id],
            isValid: true,
          };
        }

        // Si no hay dólar o categorías, marcar como no válido
        if (!hasValidDolarBlue || !categories.length) {
          console.warn('No se puede calcular precio precisamente: falta dólar blue o categorías');
          return {
            usdPrice: basePrice,
            arsPrice: 0,
            formattedUsd: formatUsdPrice(basePrice),
            formattedArs: 'Precio no disponible',
            isValid: false,
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
          const category = categories.find(c => c.id === product.category_id);
          if (category && category.profit_margin !== null && category.profit_margin !== undefined) {
            profitMargin =
              typeof category.profit_margin === 'number'
                ? category.profit_margin
                : parseFloat(String(category.profit_margin));
          }
        }

        // Asegurar que el margen sea válido
        if (isNaN(profitMargin) || profitMargin < 0) {
          profitMargin = defaultProfitMargin;
          console.warn(
            `Margen de ganancia inválido para producto ${product.id}, usando valor por defecto`
          );
        }

        // Asegurar que el tipo de cambio sea un número
        const exchangeRate = hasValidDolarBlue ? dolarBlue.venta : 0;

        if (exchangeRate <= 0) {
          console.warn('Tipo de cambio inválido:', exchangeRate);
          return {
            usdPrice: basePrice,
            arsPrice: 0,
            formattedUsd: formatUsdPrice(basePrice),
            formattedArs: 'Precio no disponible',
            isValid: false,
          };
        }

        // Calcular precios
        const usdPrice = calculateUsdPrice(basePrice, profitMargin);
        const arsPrice = calculateArsPrice(usdPrice, exchangeRate);

        // Validar resultados
        if (isNaN(usdPrice) || usdPrice <= 0 || isNaN(arsPrice) || arsPrice <= 0) {
          console.error('Cálculo de precios inválido:', {
            basePrice,
            profitMargin,
            exchangeRate,
            usdPrice,
            arsPrice,
          });
          return {
            usdPrice: basePrice,
            arsPrice: 0,
            formattedUsd: formatUsdPrice(basePrice),
            formattedArs: 'Precio no disponible',
            isValid: false,
          };
        }

        // Formatear precios
        const result = {
          usdPrice,
          arsPrice,
          formattedUsd: formatUsdPrice(usdPrice),
          formattedArs: formatArsPrice(arsPrice),
          isValid: true,
        };

        // Guardar en caché
        if (priceCache.current && result.isValid) {
          priceCache.current[product.id] = result;
        }

        return result;
      } catch (error) {
        console.error('Error al calcular precios para producto:', product.id, error);

        // En caso de error, indicar que el precio no es válido
        return {
          usdPrice: 0,
          arsPrice: 0,
          formattedUsd: 'Error en cálculo',
          formattedArs: 'Error en cálculo',
          isValid: false,
        };
      }
    }) as (product: Product) => {
      usdPrice: number;
      arsPrice: number;
      formattedUsd: string;
      formattedArs: string;
      isValid: boolean;
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
        const validProducts = productsToSort.filter(p => p != null);

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
                // Obtenemos precios de ambos productos
                const pricesA = getPrices(a);
                const pricesB = getPrices(b);

                // Si ambos precios son válidos, comparar normalmente
                if (pricesA.isValid && pricesB.isValid) {
                  return pricesA.arsPrice - pricesB.arsPrice;
                }

                // Si solo uno es válido, ese va primero (productos sin precio al final)
                if (pricesA.isValid && !pricesB.isValid) return -1;
                if (!pricesA.isValid && pricesB.isValid) return 1;

                // Si ninguno es válido, mantener el orden original
                return 0;
              } catch (e) {
                console.error('Error comparando precios ASC:', e);
                return 0;
              }
            });

          case 'price_desc':
            return sortedProducts.sort((a, b) => {
              try {
                const pricesA = getPrices(a);
                const pricesB = getPrices(b);

                // Si ambos precios son válidos, comparar normalmente
                if (pricesA.isValid && pricesB.isValid) {
                  return pricesB.arsPrice - pricesA.arsPrice;
                }

                // Si solo uno es válido, ese va primero (productos sin precio al final)
                if (pricesA.isValid && !pricesB.isValid) return -1;
                if (!pricesA.isValid && pricesB.isValid) return 1;

                // Si ninguno es válido, mantener el orden original
                return 0;
              } catch (e) {
                console.error('Error comparando precios DESC:', e);
                return 0;
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
        filtered = filtered.filter(product => product !== null && product !== undefined);

        // Filtrar por categoría
        if (filter && filter !== 'all') {
          filtered = filtered.filter(product => {
            const categoryId = parseInt(filter, 10);
            return product.category_id === categoryId;
          });
        }

        // Filtrar por disponibilidad
        if (onlyAvailable) {
          filtered = filtered.filter(product => product.stock > 0);
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
  }, [products, onlyAvailable, sortBy, sortProducts, filter]);

  // Asegurar que no se actualice el estado después de desmontado
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Método para refrescar datos
  const refreshData = useCallback(async () => {
    if (!isMounted.current) return;

    try {
      setLoading(true);

      // Invalidar caché inmediatamente antes de cargar nuevos datos
      priceCache.current = {};

      // Cargar dólar blue primero para asegurar que tenemos el tipo de cambio actualizado
      const dolarResponse = await fetch('/api/dolar-blue');
      if (dolarResponse.ok && isMounted.current) {
        const { data } = await dolarResponse.json();
        setDolarBlue(data);

        // Log para debug
        console.log('Tipo de cambio actualizado:', data?.venta);
      } else {
        console.error('Error al cargar dólar blue');
      }

      // Cargar categorías
      const catResponse = await fetch('/api/categories');
      if (catResponse.ok && isMounted.current) {
        const catData = await catResponse.json();
        setCategories(catData || []);
      } else {
        console.error('Respuesta no OK al cargar categorías:', catResponse.status);
      }

      // Cargar productos
      const queryParams = new URLSearchParams();

      if (searchParam) {
        queryParams.set('search', searchParam);
      }

      // Asegurar que el filtro de categoría se aplique correctamente
      if (filter && filter !== 'all') {
        queryParams.set('filter', filter);
      } else {
        queryParams.set('filter', 'all');
      }

      const prodResponse = await fetch(`/api/products?${queryParams.toString()}`);

      if (prodResponse.ok && isMounted.current) {
        const prodData = await prodResponse.json();
        setProducts(prodData || []);

        // Log para depuración
        console.log(`Productos actualizados con filtro: ${filter}`, prodData.length);
      } else {
        console.error('Respuesta no OK al cargar productos:', prodResponse.status);
        if (isMounted.current) {
          setProducts([]);
        }
      }

      // Aplicar filtros a la URL si estamos en la página principal
      if (pathname === '/' || pathname === '') {
        applyFiltersToUrl();
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
    pathname,
    applyFiltersToUrl,
    setCategories,
    setProducts,
    setDolarBlue,
    setLoading,
    priceCache,
    isMounted,
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
    refreshData,
  };

  return <AppStateContext.Provider value={contextValue}>{children}</AppStateContext.Provider>;
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
