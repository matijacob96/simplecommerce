'use client';

import {
  AutoComplete,
  Button,
  Card,
  Input,
  InputNumber,
  Spin,
  Table,
  Typography,
  Upload,
  Image,
  message,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  SendOutlined,
  UploadOutlined,
  LinkOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useEffect, useState, createRef, useMemo, useCallback } from 'react';
import { toaster } from '../components/ui/toaster';
import type { UploadFile } from 'antd/es/upload';
import debounce from 'lodash/debounce';
import './pedidos.css'; // Importamos un archivo CSS específico para esta página
import { createStyles } from 'antd-style';

const { Text, Title } = Typography;

type Category = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  price: number;
  category_id?: number;
};

type OrderProduct = {
  quantity: number;
  name: string;
  cost: number;
  supplier: string;
  imageUrl: string;
  categoryId?: number | null;
  categoryName?: string;
  id?: string;
  [key: string]: number | string | undefined | null; // Índice de firma para permitir acceso dinámico
};

// Tipo para las referencias de cantidad
type QuantityRef = React.RefObject<HTMLInputElement | null>;

// Tipo para los costos prorrateados
type ProratedCost = {
  proratedShippingCost: number;
  totalCost: number;
  unitCostWithShipping: number;
};

// Tipo para el error
type ApiError = Error & {
  details?: string;
  message: string;
};

// Tipo para el evento de archivo
type FileInfo = {
  file: UploadFile & {
    status?: string;
    originFileObj?: File;
  };
  fileList: UploadFile[];
};

const useStyle = createStyles(({ css }) => {
  return {
    customTable: css`
      .ant-table {
        .ant-table-container {
          .ant-table-body,
          .ant-table-content {
            scrollbar-width: thin;
            scrollbar-color: #eaeaea transparent;
            scrollbar-gutter: stable;
          }
        }
      }
    `,
  };
});

export default function PedidosPage() {
  const { styles } = useStyle();
  // Utilizamos un valor inicial para productos que incluya un ID único
  const initialProductId = `product-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const [products, setProducts] = useState<OrderProduct[]>([
    {
      quantity: 0,
      name: '',
      cost: 0,
      supplier: '',
      imageUrl: '',
      categoryId: null,
      categoryName: '',
      id: initialProductId,
    },
  ]);
  const [shippingCost, setShippingCost] = useState(0);
  const [proratedCosts, setProratedCosts] = useState<ProratedCost[]>([]);
  const [existingProducts, setExistingProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para filtros del autocompletado
  const [searchText, setSearchText] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean[]>([]);

  // Estados para gestión de imágenes
  const [fileList, setFileList] = useState<UploadFile[][]>([]);
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([]);

  // Referencias para los campos de cantidad usando un array de refs
  const [quantityRefs, setQuantityRefs] = useState<QuantityRef[]>([]);

  // Memorizar las opciones de productos filtrados para mejorar rendimiento
  const productOptions = useMemo(() => {
    return products.map((_, index) => {
      if (!searchText[index]) return [];

      return existingProducts
        .filter(product =>
          product.name.toLowerCase().includes(searchText[index]?.toLowerCase() || '')
        )
        .map(product => ({
          value: product.name,
          label: `${product.name} ($${product.price})`,
        }));
    });
  }, [existingProducts, searchText, products]);

  // Función debounce para la búsqueda de productos
  const debouncedSearch = useCallback(
    (value: string, index: number) => {
      const newSearchText = [...searchText];
      newSearchText[index] = value;
      setSearchText(newSearchText);

      const newLoading = [...loading];
      newLoading[index] = false;
      setLoading(newLoading);
    },
    [searchText, loading]
  );

  // Creamos la versión debounced de la función
  const debouncedSearchWithDelay = useMemo(() => debounce(debouncedSearch, 300), [debouncedSearch]);

  // Limpiamos el debounce cuando el componente se desmonte
  useEffect(() => {
    return () => {
      debouncedSearchWithDelay.cancel();
    };
  }, [debouncedSearchWithDelay]);

  // Manejar cambio en campo de autocompletado
  const handleAutoCompleteChange = (value: string, index: number) => {
    // Actualizar el estado del producto inmediatamente para mejor UX
    handleChange(value, index, 'name');

    // Marcar como cargando
    const newLoading = [...loading];
    newLoading[index] = true;
    setLoading(newLoading);

    // Ejecutar búsqueda con debounce
    debouncedSearchWithDelay(value, index);
  };

  useEffect(() => {
    // Crear referencias para los campos de cantidad
    const refs: QuantityRef[] = products.map(() => createRef<HTMLInputElement | null>());
    setQuantityRefs(refs);

    // Ajustar los arrays de estado según la cantidad de productos
    const newSearchText = [...searchText];
    const newLoading = [...loading];
    const newFileList = [...fileList];
    const newImageUrls = [...imageUrls];

    // Asegurarse de que los arrays tengan la misma longitud que products
    while (newSearchText.length < products.length) newSearchText.push('');
    while (newLoading.length < products.length) newLoading.push(false);
    while (newFileList.length < products.length) newFileList.push([]);
    while (newImageUrls.length < products.length) newImageUrls.push(null);

    // Recortar los arrays si son más largos que products
    if (newSearchText.length > products.length) newSearchText.length = products.length;
    if (newLoading.length > products.length) newLoading.length = products.length;
    if (newFileList.length > products.length) newFileList.length = products.length;
    if (newImageUrls.length > products.length) newImageUrls.length = products.length;

    // Solo actualizamos los estados si realmente hay cambios
    if (JSON.stringify(newSearchText) !== JSON.stringify(searchText)) {
      setSearchText(newSearchText);
    }
    if (JSON.stringify(newLoading) !== JSON.stringify(loading)) {
      setLoading(newLoading);
    }
    if (newFileList.length !== fileList.length) {
      setFileList(newFileList);
    }
    if (newImageUrls.length !== imageUrls.length) {
      setImageUrls(newImageUrls);
    }

    // No necesitamos incluir quantityRefs aquí ya que lo estamos actualizando directamente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  // Efecto para enfocar el último campo de cantidad al agregar un producto nuevo
  useEffect(() => {
    // Evitamos cambios de estado durante la renderización inicial
    if (products.length > 0) {
      // Enfocar el último campo de cantidad cuando se agrega un producto nuevo
      const lastIndex = products.length - 1;
      if (lastIndex >= 0 && quantityRefs[lastIndex] && quantityRefs[lastIndex].current) {
        quantityRefs[lastIndex].current?.focus();
      }
    }
  }, [products.length, quantityRefs]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      try {
        // Primero cargamos categorías porque son pocas
        const categoriesResponse = await fetch('/api/categories');
        const categoriesData = await categoriesResponse.json();

        setCategories(categoriesData);

        // Luego cargamos productos (operación más pesada)
        const productsResponse = await fetch('/api/products');
        const productsData = await productsResponse.json();

        setExistingProducts(productsData);
      } catch (error) {
        toaster.error(
          'Error al cargar datos: ' + (error instanceof Error ? error.message : 'Error desconocido')
        );
      }
    };

    loadData();
    // Mantenemos la dependencia vacía porque solo queremos que se ejecute una vez al montar
  }, []);

  const handleSelectProduct = (productName: string, index: number) => {
    // Buscar el producto seleccionado
    const selectedProduct = existingProducts.find(p => p.name === productName);

    if (selectedProduct) {
      // Actualizar el producto con los datos del producto seleccionado
      const newProducts = [...products];
      // Verificamos que el elemento en el índice exista
      if (newProducts[index]) {
        newProducts[index].name = selectedProduct.name;
        newProducts[index].cost = selectedProduct.price;

        // Obtener la categoría si existe
        if (selectedProduct.category_id) {
          const productCategory = categories.find(c => c.id === selectedProduct.category_id);
          if (productCategory && newProducts[index]) {
            newProducts[index].categoryId = productCategory.id;
            newProducts[index].categoryName = productCategory.name;
          }
        }

        setProducts(newProducts);
      }

      // Después de seleccionar, enfocar el campo de cantidad
      if (quantityRefs[index] && quantityRefs[index].current) {
        quantityRefs[index].current?.focus();
      }
    }
  };

  const handleCategoryChange = (value: string, index: number) => {
    // Buscar la categoría seleccionada
    const selectedCategory = categories.find(c => c.name === value);

    // Actualizar el producto con la categoría seleccionada
    const newProducts = [...products];

    // Verificamos que el elemento en el índice exista
    if (newProducts[index]) {
      if (selectedCategory) {
        // Si encontramos la categoría, usar su ID
        newProducts[index].categoryId = selectedCategory.id;
        newProducts[index].categoryName = selectedCategory.name;
      } else {
        // Si no, es una nueva categoría (guardaremos solo el nombre)
        newProducts[index].categoryId = null;
        newProducts[index].categoryName = value;
      }

      setProducts(newProducts);
    }
  };

  const addProduct = () => {
    // Generamos un ID único para el nuevo producto
    const newId = `product-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setProducts([
      ...products,
      {
        quantity: 0,
        name: '',
        cost: 0,
        supplier: '',
        imageUrl: '',
        categoryId: null,
        categoryName: '',
        id: newId,
      },
    ]);
  };

  const removeProduct = (index: number) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const handleChange = (value: string | number | null, index: number, field: string) => {
    const newProducts = [...products];

    // Verificamos que el elemento en el índice exista
    if (newProducts[index]) {
      if (field === 'quantity' || field === 'cost') {
        // Formatear a 2 decimales para los campos numéricos
        let numValue = typeof value === 'number' ? value : 0;

        // Para el campo de costo, formatear a 2 decimales
        if (field === 'cost') {
          numValue = Number(numValue.toFixed(2));
        }

        newProducts[index][field] = numValue;
      } else {
        newProducts[index][field] = value as string;

        // Si se está cambiando el campo categoryName manualmente
        if (field === 'categoryName') {
          // Buscar si existe la categoría por nombre
          const valueAsString = String(value);
          const existingCategory = categories.find(
            c => c.name.toLowerCase() === valueAsString.toLowerCase()
          );

          if (existingCategory) {
            // Si es una categoría existente
            newProducts[index].categoryId = existingCategory.id;
          } else {
            // Si es una nueva categoría (texto)
            newProducts[index].categoryId = null;
          }
        }
      }

      setProducts(newProducts);
    }
  };

  const handleShippingCostChange = (value: number | null) => {
    setShippingCost(value || 0);
  };

  const calculateProratedCosts = useCallback(() => {
    const totalProductCost = products.reduce(
      (acc, product) => acc + product.quantity * product.cost,
      0
    );

    if (totalProductCost === 0) {
      // Si no hay costo, establecemos todo a cero y retornamos
      const zeroCosts = products.map(() => ({
        proratedShippingCost: 0,
        totalCost: 0,
        unitCostWithShipping: 0,
      }));

      // Comparamos si los valores son diferentes antes de actualizar el estado
      if (JSON.stringify(zeroCosts) !== JSON.stringify(proratedCosts)) {
        setProratedCosts(zeroCosts);
      }
      return;
    }

    const prorated = products.map(product => {
      const productTotalCost = product.quantity * product.cost;
      const proratedShipping = (productTotalCost / totalProductCost) * shippingCost;
      const totalCost = productTotalCost + proratedShipping;
      // Cálculo del costo unitario incluyendo el envío prorrateado
      const unitCostWithShipping =
        product.quantity > 0 ? product.cost + proratedShipping / product.quantity : 0;

      // Convertir a número y validar que no sea NaN
      const validProratedShipping = Number.isNaN(proratedShipping) ? 0 : Number(proratedShipping);
      const validTotalCost = Number.isNaN(totalCost) ? 0 : Number(totalCost);
      const validUnitCostWithShipping = Number.isNaN(unitCostWithShipping)
        ? 0
        : Number(unitCostWithShipping);

      // Asegurémonos de que todos son valores numéricos, reemplazando NaN por 0
      return {
        proratedShippingCost: validProratedShipping,
        totalCost: validTotalCost,
        unitCostWithShipping: validUnitCostWithShipping,
      };
    });

    // Comparamos si los valores son diferentes antes de actualizar el estado
    if (JSON.stringify(prorated) !== JSON.stringify(proratedCosts)) {
      setProratedCosts(prorated);
    }
  }, [products, shippingCost, proratedCosts]);

  useEffect(() => {
    calculateProratedCosts();
  }, [calculateProratedCosts]);

  // Modificamos las columnas para manejar posibles valores no numéricos
  const formatNumberOrZero = (value: number | undefined | null) => {
    const num = Number(value);
    return !isNaN(num) ? num.toFixed(2) : '0.00';
  };

  // Funciones de ayuda para el InputNumber

  const parseCurrency = (value: string | undefined): number => {
    if (!value || typeof value !== 'string') return 0;
    return parseFloat(value.replace(/\$\s?|(,*)/g, '')) || 0;
  };

  // Manejar el keyDown para detectar Enter
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // Si es el último producto, agregar uno nuevo sin importar el campo
      if (index === products.length - 1) {
        addProduct();
      } else {
        // Si no es el último producto, pasar al campo de cantidad del siguiente producto
        const nextRef = quantityRefs[index + 1];
        if (nextRef && nextRef.current) {
          nextRef.current.focus();
        }
      }
    }
  };

  const handleSubmit = async () => {
    // Validar que haya al menos un producto con datos
    const isValid = products.some(
      product => product.quantity > 0 && product.name.trim() !== '' && product.cost > 0
    );

    if (!isValid) {
      toaster.error('Debe completar al menos un producto con todos sus datos');
      return;
    }

    setIsSubmitting(true);

    try {
      // Preparar los datos para enviar
      const orderData = {
        products: products
          .filter(product => product.quantity > 0 && product.name.trim() !== '' && product.cost > 0)
          .map(product => ({
            quantity: product.quantity,
            name: product.name.trim(),
            cost: product.cost,
            supplier: product.supplier.trim(),
            imageUrl: product.imageUrl,
            categoryId: product.categoryId,
            categoryName: product.categoryName?.trim(),
          })),
        shippingCost,
        proratedCosts,
      };

      // Enviar los datos
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al guardar el pedido');
      }

      toaster.success('Pedido guardado correctamente');

      // Reiniciar el formulario
      setProducts([
        {
          quantity: 0,
          name: '',
          cost: 0,
          supplier: '',
          imageUrl: '',
          categoryId: null,
          categoryName: '',
        },
      ]);
      setShippingCost(0);
      setFileList([[]]);
      setImageUrls([null]);
    } catch (error) {
      const err = error as ApiError;
      toaster.error('Error al enviar los datos: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función para manejar la subida de archivos
  const handleFileChange = (info: FileInfo, index: number) => {
    const { file, fileList: newFileList } = info;

    // Actualizar la lista de archivos para este índice específico
    const newFileListArray = [...fileList];
    newFileListArray[index] = newFileList;
    setFileList(newFileListArray);

    if (file.status === 'removed') {
      const newImageUrls = [...imageUrls];
      newImageUrls[index] = null;
      setImageUrls(newImageUrls);

      // Actualizar el producto
      const newProducts = [...products];
      if (newProducts[index]) {
        // Verificar que existe
        newProducts[index].imageUrl = '';
        setProducts(newProducts);
      }
      return;
    }

    // Si hay un archivo, establecer la URL de previsualización
    if (newFileList.length > 0) {
      const lastFile = newFileList[newFileList.length - 1];
      // Verificar que lastFile existe y tiene originFileObj
      if (lastFile && lastFile.originFileObj) {
        // Crear objeto URL para previsualización
        const objectUrl = URL.createObjectURL(lastFile.originFileObj);

        // Actualizar la URL de imagen para este índice
        const newImageUrls = [...imageUrls];
        newImageUrls[index] = objectUrl;
        setImageUrls(newImageUrls);

        // Actualizar el producto
        const newProducts = [...products];
        if (newProducts[index]) {
          // Verificar que existe
          newProducts[index].imageUrl = objectUrl;
          setProducts(newProducts);
        }
      }
    }
  };

  // Función para manejar la URL de imagen
  const handleImageUrl = (url: string, index: number) => {
    if (!url) return;

    // Verificar si es una URL externa
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Mostrar mensaje de carga
      message.loading({
        content: 'Procesando imagen...',
        key: `image-${index}`,
      });

      // Usamos un ID temporal basado en el índice y timestamp
      const tempProductId = `temp-${index}-${Date.now()}`;

      // Llamar a la API para procesar la URL
      fetch('/api/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          productId: tempProductId,
        }),
      })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Error al procesar la URL de la imagen');
        })
        .then(result => {
          // Actualizar el producto con la URL procesada
          const newProducts = [...products];
          if (newProducts[index]) {
            // Verificar que existe
            newProducts[index].imageUrl = result.url;
            setProducts(newProducts);
          }

          // Actualizar la URL de previsualización
          const newImageUrls = [...imageUrls];
          newImageUrls[index] = result.url;
          setImageUrls(newImageUrls);

          // Limpiar archivos si había
          const newFileListArray = [...fileList];
          newFileListArray[index] = [];
          setFileList(newFileListArray);

          // Mostrar mensaje de éxito
          message.success({
            content: 'Imagen procesada correctamente',
            key: `image-${index}`,
          });
        })
        .catch(error => {
          message.error({
            content: error.message || 'Error al procesar la imagen',
            key: `image-${index}`,
          });
        });
    }
  };

  const columns = [
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 90,
      render: (_text: string, _record: OrderProduct, index: number) => {
        // Verificamos que el elemento en el índice exista
        const product = products[index];
        if (!product) return null;

        return (
          <InputNumber
            min={0}
            value={product.quantity}
            onChange={value => handleChange(value, index, 'quantity')}
            placeholder="Cantidad"
            ref={quantityRefs[index]}
            onKeyDown={e => handleKeyDown(e, index)}
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: 'Nombre Producto',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (_text: string, _record: OrderProduct, index: number) => {
        // Verificamos que el elemento en el índice exista
        const product = products[index];
        if (!product) return null;

        return (
          <AutoComplete
            style={{ width: '100%' }}
            placeholder="Nombre del producto"
            value={product.name}
            options={productOptions[index]}
            onChange={value => handleAutoCompleteChange(value, index)}
            onSelect={value => handleSelectProduct(value, index)}
            filterOption={false}
            onKeyDown={e => handleKeyDown(e, index)}
            notFoundContent={loading[index] ? <Spin size="small" /> : null}
          />
        );
      },
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (_text: string, _record: OrderProduct, index: number) => {
        // Verificar que el producto exista
        const product = products[index];
        if (!product) return null;

        // Usar el nombre de la categoría para mostrar
        const displayValue = product.categoryName || '';

        // Categorías existentes como opciones para el AutoComplete
        return (
          <div style={{ width: '100%', height: '32px' }}>
            <AutoComplete
              style={{ width: '100%' }}
              placeholder="Selecciona categoría"
              value={displayValue}
              options={categories.map(cat => ({
                value: cat.name,
                label: cat.name,
              }))}
              onChange={value => handleChange(value, index, 'categoryName')}
              filterOption={(inputValue, option) =>
                option?.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
              onSelect={value => handleCategoryChange(value, index)}
              onKeyDown={e => handleKeyDown(e, index)}
              className="category-autocomplete"
              popupMatchSelectWidth={true}
              dropdownStyle={{ zIndex: 1050 }}
            />
          </div>
        );
      },
    },
    {
      title: 'Costo',
      dataIndex: 'cost',
      key: 'cost',
      width: 110,
      render: (_text: string, _record: OrderProduct, index: number) => {
        // Verificamos que el elemento en el índice exista
        const product = products[index];
        if (!product) return null;

        return (
          <InputNumber
            min={0}
            step={0.01}
            value={product.cost}
            onChange={value => handleChange(value, index, 'cost')}
            placeholder="Costo"
            formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value): number => parseCurrency(value)}
            onKeyDown={e => handleKeyDown(e, index)}
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: 'Proveedor',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 140,
      render: (_text: string, _record: OrderProduct, index: number) => {
        // Verificamos que el elemento en el índice exista
        const product = products[index];
        if (!product) return null;

        return (
          <Input
            value={product.supplier}
            onChange={e => handleChange(e.target.value, index, 'supplier')}
            placeholder="Proveedor"
            onKeyDown={e => handleKeyDown(e, index)}
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: 'Imagen',
      dataIndex: 'image',
      key: 'image',
      width: 220,
      render: (_text: string, _record: OrderProduct, index: number) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Mostrar la imagen si hay una URL */}
          {imageUrls[index] && (
            <div style={{ marginRight: 8, position: 'relative' }}>
              <Image
                src={imageUrls[index] || ''}
                alt="Product"
                width={32}
                height={32}
                style={{ objectFit: 'cover' }}
                preview={false}
              />
              <Button
                type="text"
                icon={<CloseCircleOutlined />}
                size="small"
                style={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  padding: 0,
                  minWidth: 16,
                  minHeight: 16,
                  fontSize: 12,
                }}
                onClick={() => {
                  // Limpiar la imagen
                  const newImageUrls = [...imageUrls];
                  newImageUrls[index] = null;
                  setImageUrls(newImageUrls);

                  // Limpiar archivos
                  const newFileListArray = [...fileList];
                  newFileListArray[index] = [];
                  setFileList(newFileListArray);

                  // Actualizar el producto
                  const newProducts = [...products];
                  if (newProducts[index]) {
                    // Verificar que existe
                    newProducts[index].imageUrl = '';
                    setProducts(newProducts);
                  }
                }}
              />
            </div>
          )}

          {/* Control de carga de imagen */}
          <Upload
            fileList={fileList[index] || []}
            onChange={info => handleFileChange(info as FileInfo, index)}
            showUploadList={false}
            maxCount={1}
            accept="image/*"
            customRequest={({ onSuccess }) => {
              if (onSuccess) onSuccess('ok');
            }}
          >
            <Button icon={<UploadOutlined />}>Subir</Button>
          </Upload>

          {/* Input para URL externa */}
          <Input
            placeholder="URL de imagen"
            suffix={
              <Button
                type="text"
                icon={<LinkOutlined />}
                onClick={() => {
                  const input = document.getElementById(`url-input-${index}`) as HTMLInputElement;
                  if (input && input.value) {
                    handleImageUrl(input.value, index);
                    input.value = '';
                  }
                }}
                style={{ border: 'none' }}
              />
            }
            id={`url-input-${index}`}
            onPressEnter={e => {
              e.preventDefault();
              const target = e.target as HTMLInputElement;
              if (target.value) {
                handleImageUrl(target.value, index);
                target.value = '';
              }
            }}
            style={{ marginLeft: 8, flex: 1 }}
          />
        </div>
      ),
    },
    {
      title: 'Envío Prorrateado',
      dataIndex: 'proratedShippingCost',
      key: 'proratedShippingCost',
      width: 130,
      render: (_text: string, _record: OrderProduct, index: number) => (
        <Text>$ {formatNumberOrZero(getProrationForIndex(index).proratedShippingCost)}</Text>
      ),
    },
    {
      title: 'Precio Final Unitario',
      dataIndex: 'finalUnitCost',
      key: 'finalUnitCost',
      width: 150,
      render: (_text: string, _record: OrderProduct, index: number) => (
        <Text type="success">
          $ {formatNumberOrZero(getProrationForIndex(index).unitCostWithShipping)}
        </Text>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 100,
      render: (_text: string, _record: OrderProduct, index: number) => (
        <Text strong>$ {formatNumberOrZero(getProrationForIndex(index).totalCost)}</Text>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 80,
      render: (_text: string, _record: OrderProduct, index: number) => (
        <Button
          type="text"
          danger
          onClick={() => removeProduct(index)}
          icon={<DeleteOutlined />}
          style={{ display: products.length > 1 ? 'inline-block' : 'none' }}
        />
      ),
    },
  ];

  // Asegurémonos de que el getProrationForIndex sea memoizado para evitar recálculos innecesarios
  const getProrationForIndex = useCallback(
    (index: number): ProratedCost => {
      return (
        proratedCosts[index] || {
          proratedShippingCost: 0,
          totalCost: 0,
          unitCostWithShipping: 0,
        }
      );
    },
    [proratedCosts]
  );

  return (
    <div
      style={{
        padding: 16,
        height: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Card
        title={
          <Title level={3} style={{ margin: 0 }}>
            Nuevo Pedido
          </Title>
        }
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 80px)',
        }}
        styles={{
          body: {
            flex: 1,
            padding: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        actions={[
          <div
            key="actions"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Text strong style={{ marginRight: 8 }}>
                Costo de Envío:
              </Text>
              <InputNumber
                style={{ width: 120 }}
                value={shippingCost}
                onChange={handleShippingCostChange}
                min={0}
                step={0.01}
                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value): number => parseCurrency(value)}
              />
            </div>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={isSubmitting}
            >
              Guardar Pedido
            </Button>
          </div>,
        ]}
      >
        <div
          style={{
            flex: 1,
            padding: '0',
            overflow: 'hidden',
          }}
        >
          <Table
            dataSource={products}
            columns={columns}
            rowKey={record => record.id || `fallback-${Math.random()}`}
            pagination={false}
            bordered
            scroll={{ y: 'calc( 100vh - 390px )' }}
            tableLayout="fixed"
            sticky
            className={styles.customTable}
            summary={() => {
              // Calcular totales
              const totalQuantity = products.reduce((acc, product) => acc + product.quantity, 0);
              const totalCost = proratedCosts.reduce((acc, cost) => acc + cost.totalCost, 0);

              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong>{totalQuantity}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} colSpan={6}>
                      <Button
                        type="dashed"
                        onClick={addProduct}
                        icon={<PlusOutlined />}
                        style={{ width: '100%' }}
                      >
                        Agregar Producto
                      </Button>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7} colSpan={3}>
                      <Text strong>TOTAL: $ {formatNumberOrZero(totalCost)}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </div>
      </Card>
    </div>
  );
}
