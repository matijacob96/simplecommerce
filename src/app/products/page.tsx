"use client";

import { useState, useEffect, useRef } from "react";
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    InputNumber,
    AutoComplete,
    message,
    Space,
    Typography,
    Tooltip,
    Popconfirm,
    Row,
    Col,
    Card,
    Image,
    Upload,
    Pagination
} from "antd";
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SearchOutlined,
    InfoCircleOutlined,
    LinkOutlined,
    CloseCircleOutlined,
    LoadingOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { InputRef } from "antd/es/input";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import supabase from "@/lib/supabase";
import {
    calculateUsdPrice,
    calculateArsPrice,
    formatUsdPrice,
    formatArsPrice
} from "@/utils/priceUtils";

const { Title, Text } = Typography;
const { Dragger } = Upload;

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
    image?: string | null;
    category_id?: number | null;
    category?: Category | null;
};

type DolarBlue = {
    compra: number;
    venta: number;
    fromCache?: boolean;
    timestamp: number;
};

export default function ProductsPage() {
    // Estado de montaje para evitar actualizaciones después del desmontaje
    const isMounted = useRef(true);
    
    // Referencia para detectar si estamos en una transición de página
    const isPageChanging = useRef(false);
    
    // Estados
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [dolarBlue, setDolarBlue] = useState<DolarBlue | null>(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState("");
    const searchInputRef = useRef<InputRef>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [defaultProfitMargin, setDefaultProfitMargin] = useState<number>(0.2);
    const [selectedCategoryMargin, setSelectedCategoryMargin] = useState<number>(defaultProfitMargin);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
    const [uploading, setUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [shouldClearImage, setShouldClearImage] = useState(false);
    const [calculatedUsdPrice, setCalculatedUsdPrice] = useState<number | null>(null);
    const [calculatedArsPrice, setCalculatedArsPrice] = useState<number | null>(null);

    // Estados para acciones en masa
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
    const [bulkCategoryId, setBulkCategoryId] = useState<number | null>(null);
    const [bulkCategoryName, setBulkCategoryName] = useState<string>("");
    const [isBulkLoading, setIsBulkLoading] = useState(false);

    // Estados para paginación
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    
    // Estado para ordenamiento
    const [sortedInfo, setSortedInfo] = useState<{
        columnKey?: string | null,
        order?: 'ascend' | 'descend' | null
    }>({
        columnKey: 'id',
        order: 'ascend'
    });

    // Efecto para manejo del montaje/desmontaje
    useEffect(() => {
        isMounted.current = true;
        
        // Sobreescribir console.error para suprimir warnings específicos
        const originalConsoleError = console.error;
        console.error = (...args) => {
            // Suprimir el warning específico de Ant Design CSS-in-JS
            if (typeof args[0] === 'string' && args[0].includes('You are registering a cleanup function after unmount')) {
                return;
            }
            originalConsoleError(...args);
        };
        
        return () => {
            isMounted.current = false;
            // Restaurar console.error original
            console.error = originalConsoleError;
        };
    }, []);

    // Efecto para cargar datos iniciales
    useEffect(() => {
        Promise.all([
            fetchProducts(),
            fetchCategories(),
            fetchDolarBlue(),
            fetchSettings()
        ]).then(() => {
            if (isMounted.current) {
                setLoading(false);
            }
        });
    }, []);

    // Función para actualizar estados de forma segura
    const safeSetState = (setter: any, value: any) => {
        if (isMounted.current) {
            setter(value);
        }
    };
    
    // Función para cambiar la página de forma segura
    const handlePageChange = (page: number) => {
        try {
            // Marcar que estamos en cambio de página para evitar operaciones durante la transición
            isPageChanging.current = true;
            
            // Agregar clase para desactivar transiciones
            const tableContainer = document.querySelector('.products-table')?.closest('.ant-table-wrapper');
            if (tableContainer) {
                tableContainer.classList.add('page-transition');
            }
            
            // Esperar al siguiente ciclo antes de hacer el cambio
            setTimeout(() => {
                if (isMounted.current) {
                    setCurrentPage(page);
                    // Desmarcar el cambio de página después de un breve tiempo
                    setTimeout(() => {
                        isPageChanging.current = false;
                        
                        // Remover clase al finalizar
                        if (tableContainer) {
                            tableContainer.classList.remove('page-transition');
                        }
                    }, 50);
                }
            }, 0);
        } catch (e) {
            isPageChanging.current = false;
            console.error('Error al cambiar página:', e);
        }
    };

    // Función para manejar cambios en la tabla (ordenamiento)
    const handleTableChange = (pagination: any, filters: any, sorter: any) => {
        // Si estamos en cambio de página o el componente está desmontado, ignorar el cambio
        if (!isMounted.current || isPageChanging.current) return;
        
        try {
            // Verificamos si sorter es un array (múltiples columnas) o un solo objeto
            if (Array.isArray(sorter)) {
                // Si hay múltiples ordenamientos, tomamos el primero
                if (sorter.length > 0) {
                    safeSetState(setSortedInfo, {
                        columnKey: sorter[0].columnKey,
                        order: sorter[0].order
                    });
                } else {
                    safeSetState(setSortedInfo, {});
                }
            } else {
                // Un solo ordenamiento
                safeSetState(setSortedInfo, {
                    columnKey: sorter.columnKey || null,
                    order: sorter.order || null
                });
            }
        } catch (e) {
            console.error('Error en handleTableChange:', e);
        }
    };

    // Funciones para obtener datos
    const fetchProducts = async () => {
        try {
            const response = await fetch("/api/products");
            if (!response.ok) throw new Error("No se pudieron cargar los productos");
            const data = await response.json();
            safeSetState(setProducts, data);
            return data;
        } catch (error) {
            console.error("Error al cargar los productos:", error);
            message.error("No se pudieron cargar los productos");
            return [];
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch("/api/categories");
            if (!response.ok) throw new Error("No se pudieron cargar las categorías");
            const data = await response.json();
            safeSetState(setCategories, data);

            return data;
        } catch (error) {
            console.error("Error al cargar las categorías:", error);
            message.error("No se pudieron cargar las categorías");
            return [];
        }
    };

    const fetchDolarBlue = async () => {
        try {
            const response = await fetch("/api/dolar-blue");
            if (!response.ok) throw new Error("No se pudo cargar el valor del dólar");
            const data = await response.json();
            if (data.success) {
                safeSetState(setDolarBlue, data.data);
            } else {
                message.error(data.message);
            }
            return data;
        } catch (error) {
            console.error("Error al cargar el valor del dólar:", error);
            message.error("No se pudo cargar el valor del dólar");
            return null;
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await fetch("/api/settings");
            if (!response.ok) return;
            const data = await response.json();
            if (data && data.default_profit_margin !== undefined) {
                const margin = Number(data.default_profit_margin);
                const validMargin = isNaN(margin) ? 0.2 : margin;
                safeSetState(setDefaultProfitMargin, validMargin);
            }
        } catch (error) {
            console.error("Error al cargar la configuración:", error);
        }
    };

    // Función para manejar la subida de archivos
    const handleFileChange = (info: any) => {
        const { file, fileList: newFileList } = info;
        setFileList(newFileList);

        if (file.status === 'removed') {
            return;
        }

        // Si hay un archivo, establecer la URL de previsualización
        if (newFileList.length > 0) {
            const lastFile = newFileList[newFileList.length - 1];
            if (lastFile.originFileObj) {
                // Crear objeto URL para previsualización
                const objectUrl = URL.createObjectURL(lastFile.originFileObj);
                setImageUrl(objectUrl);

                // Limpiar la URL cuando se desmonte el componente
                return () => URL.revokeObjectURL(objectUrl);
            }
        } else {
            setImageUrl(null);
        }
    };

    // Función para eliminar la imagen
    const handleRemoveImage = () => {
        setFileList([]);
        setImageUrl(null);
        setShouldClearImage(true);
        form.setFieldsValue({ imageUrl: '' });
    };

    // Funciones para el formulario
    const showModal = (edit = false, product: Product | null = null) => {
        // Primero resetear los campos y establecer valores por defecto
        form.resetFields();
        setFileList([]);
        setImageUrl(null);
        setShouldClearImage(false);
        setCalculatedUsdPrice(null);
        setCalculatedArsPrice(null);

        // Inicializar valores predeterminados
        let categoryName = "";
        let categoryMargin = defaultProfitMargin;

        if (edit && product) {
            // Buscar el nombre de la categoría si existe
            if (product.category_id) {
                const category = categories.find(c => c.id === product.category_id);
                if (category) {
                    categoryName = category.name || "";
                    categoryMargin = getCategoryMargin(product.category_id);
                }
            } else if (product.category?.name) {
                categoryName = product.category.name;
                categoryMargin = product.category.profit_margin !== null && product.category.profit_margin !== undefined
                    ? Number(product.category.profit_margin)
                    : defaultProfitMargin;
            }

            // Si el producto tiene imagen, establecerla como imageUrl
            if (product.image) {
                setImageUrl(product.image);
            }
        }

        // Actualizar estados locales antes de abrir el modal
        setSelectedCategoryName(categoryName);
        setSelectedCategoryMargin(categoryMargin);

        // Después de configurar todo, mostrar el modal y establecer otros estados
        setIsModalOpen(true);
        setIsEditing(edit);
        setCurrentProduct(product);

        // Establecer valores en el formulario después de abrir el modal
        // Lo hacemos aquí para asegurar que los valores se establezcan correctamente
        setTimeout(() => {
            form.setFieldsValue({
                name: edit && product ? product.name : "",
                price: edit && product ? product.price : "",
                stock: edit && product ? product.stock : "",
                category_id: categoryName
            });

            // Después de establecer los valores en el formulario, calcular los precios
            if (edit && product) {
                // Convertir a número si es string
                const numericPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;

                if (!isNaN(numericPrice)) {
                    const usdPrice = calculateUsdPrice(numericPrice, categoryMargin, defaultProfitMargin);
                    setCalculatedUsdPrice(usdPrice);

                    const arsPrice = calculateArsPrice(usdPrice, dolarBlue?.venta);
                    setCalculatedArsPrice(arsPrice);

                    console.log('Precios iniciales calculados:', {
                        costo: numericPrice,
                        categoria: categoryName,
                        margen: categoryMargin,
                        precioUSD: usdPrice,
                        precioARS: arsPrice
                    });
                }
            }
        }, 100); // Un pequeño retraso para asegurar que el modal está abierto
    };

    const handleCancel = () => {
        if (isSubmitting) return;
        setIsModalOpen(false);
        form.resetFields();
        setFileList([]);
        setImageUrl(null);
        setShouldClearImage(false);
        setCalculatedUsdPrice(null);
        setCalculatedArsPrice(null);
    };

    // Función para obtener el margen de ganancia según la categoría
    const getCategoryMargin = (categoryId: number | null | undefined): number => {
        if (categoryId === null || categoryId === undefined) return defaultProfitMargin;
        const category = categories.find(c => c.id === categoryId);
        return category?.profit_margin !== null && category?.profit_margin !== undefined
            ? Number(category.profit_margin)
            : defaultProfitMargin;
    };

    // Función para mostrar el margen de ganancia como porcentaje
    const formatProfitMargin = (margin: number): string => {
        return `${(margin * 100).toFixed(0)}%`;
    };

    // Función para crear o actualizar un producto
    const handleSubmit = async () => {
        try {
            setIsSubmitting(true);
            const values = await form.validateFields();

            // Encontrar el ID de la categoría basado en el nombre seleccionado
            let categoryId = null;
            if (values.category_id) {
                // Comprobar si es un ID o un nombre
                const possibleId = Number(values.category_id);
                if (!isNaN(possibleId)) {
                    categoryId = possibleId;
                } else {
                    // Es un nombre, buscar el ID correspondiente
                    const category = categories.find(c => c.name === values.category_id);
                    categoryId = category?.id || null;
                }

                values.category_id = categoryId;
            }

            const url = isEditing && currentProduct
                ? `/api/products/${currentProduct.id}`
                : '/api/products';

            // Preparar datos para enviar
            const productData: any = {
                ...values,
                id: isEditing && currentProduct ? currentProduct.id : undefined,
                clearImage: shouldClearImage
            };

            // Si se ingresó una URL de imagen directamente
            if (values.imageUrl && values.imageUrl.trim() !== '') {
                productData.imageUrl = values.imageUrl;
            }

            // Primero crear o actualizar el producto
            const response = await fetch(url, {
                method: isEditing ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Ha ocurrido un error");
            }

            const savedProduct = await response.json();

            // Si hay un archivo para subir, subirlo a través de la API
            if (fileList.length > 0 && fileList[0].originFileObj) {
                setUploading(true);

                // Crear FormData
                const formData = new FormData();
                formData.append('file', fileList[0].originFileObj);
                formData.append('productId', savedProduct.id.toString());

                // Enviar a la API de imágenes
                const imageResponse = await fetch('/api/images', {
                    method: 'POST',
                    body: formData,
                });

                if (imageResponse.ok) {
                    const imageData = await imageResponse.json();
                    // Actualizar la imagen en el producto
                    savedProduct.image = imageData.url;

                    // También actualizar el producto en la base de datos con la nueva URL de imagen
                    await fetch(`/api/products/${savedProduct.id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            id: savedProduct.id,
                            image: imageData.url
                        }),
                    });
                } else {
                    const errorData = await imageResponse.json();
                    message.error(`Error al subir la imagen: ${errorData.error}`);
                }

                setUploading(false);
            }

            message.success(`Producto ${isEditing ? 'actualizado' : 'creado'} correctamente`);
            setIsModalOpen(false);

            // Actualizar la lista de productos
            if (isEditing) {
                setProducts(products.map(p => p.id === savedProduct.id ? savedProduct : p));
            } else {
                setProducts([...products, savedProduct]);
            }

            // Reiniciar estados
            form.resetFields();
            setFileList([]);
            setImageUrl(null);
            setShouldClearImage(false);

        } catch (error) {
            message.error(`Error: ${error instanceof Error ? error.message : "Error desconocido"}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Función para calcular y actualizar los precios de venta
    const updateCalculatedPrices = () => {
        const costPrice = form.getFieldValue('price');
        console.log('Calculando precios con costo:', costPrice, 'margen:', selectedCategoryMargin);

        if (costPrice) {
            // Convertir a número si es string
            const numericPrice = typeof costPrice === 'string' ? parseFloat(costPrice) : costPrice;

            if (isNaN(numericPrice)) {
                setCalculatedUsdPrice(null);
                setCalculatedArsPrice(null);
                return;
            }

            const usdPrice = calculateUsdPrice(numericPrice, selectedCategoryMargin, defaultProfitMargin);
            setCalculatedUsdPrice(usdPrice);

            const arsPrice = calculateArsPrice(usdPrice, dolarBlue?.venta);
            setCalculatedArsPrice(arsPrice);

            console.log('Precios calculados - USD:', usdPrice, 'ARS:', arsPrice);
        } else {
            setCalculatedUsdPrice(null);
            setCalculatedArsPrice(null);
        }
    };

    // Función para eliminar un producto
    const handleDelete = async (id: number) => {
        try {
            const response = await fetch(`/api/products/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al eliminar el producto");
            }

            setProducts(prevProducts => prevProducts.filter(p => p.id !== id));
            message.success("Producto eliminado correctamente");
        } catch (error: any) {
            message.error(error.message || "Error al eliminar el producto");
        }
    };

    // Función para normalizar URL de imagen
    const normFile = (e: any) => {
        if (Array.isArray(e)) {
            return e;
        }
        return e?.fileList;
    };

    // Configuración para el componente Upload
    const uploadProps: UploadProps = {
        name: 'file',
        multiple: false,
        fileList,
        beforeUpload: () => false,
        onChange: handleFileChange,
        accept: 'image/*',
        maxCount: 1,
        onRemove: () => {
            setImageUrl(null);
            return true;
        },
        listType: 'picture-card'
    };

    // Obtener productos ordenados y filtrados
    const getTableData = () => {
        // Primero filtramos los productos por texto de búsqueda
        const filteredProducts = products.filter(product =>
            searchText === "" ||
            product.name.toLowerCase().includes(searchText.toLowerCase())
        );
        
        // Luego ordenamos los productos filtrados según el criterio de ordenamiento
        const sortedProducts = [...filteredProducts].sort((a, b) => {
            const { columnKey, order } = sortedInfo;
            
            if (!columnKey || !order) {
                // Si no hay ordenamiento, ordenamos por ID por defecto
                return a.id - b.id;
            }
            
            // Según la columna ordenamos de forma diferente
            switch (columnKey) {
                case 'id':
                    const idA = typeof a.id === 'string' ? parseInt(a.id, 10) : a.id;
                    const idB = typeof b.id === 'string' ? parseInt(b.id, 10) : b.id;
                    return order === 'ascend' ? idA - idB : idB - idA;
                    
                case 'name':
                    return order === 'ascend' 
                        ? a.name.localeCompare(b.name) 
                        : b.name.localeCompare(a.name);
                    
                case 'cost':
                    const priceA = typeof a.price === 'string' ? parseFloat(a.price) : a.price;
                    const priceB = typeof b.price === 'string' ? parseFloat(b.price) : b.price;
                    return order === 'ascend' ? priceA - priceB : priceB - priceA;
                    
                case 'price_usd':
                    const usdA = calculateUsdPrice(
                        typeof a.price === 'string' ? parseFloat(a.price) : a.price,
                        a.category?.profit_margin,
                        defaultProfitMargin
                    );
                    const usdB = calculateUsdPrice(
                        typeof b.price === 'string' ? parseFloat(b.price) : b.price,
                        b.category?.profit_margin,
                        defaultProfitMargin
                    );
                    return order === 'ascend' ? usdA - usdB : usdB - usdA;
                    
                case 'price_ars':
                    const usdPrice1 = calculateUsdPrice(
                        typeof a.price === 'string' ? parseFloat(a.price) : a.price,
                        a.category?.profit_margin,
                        defaultProfitMargin
                    );
                    const usdPrice2 = calculateUsdPrice(
                        typeof b.price === 'string' ? parseFloat(b.price) : b.price,
                        b.category?.profit_margin,
                        defaultProfitMargin
                    );
                    const arsA = calculateArsPrice(usdPrice1, dolarBlue?.venta);
                    const arsB = calculateArsPrice(usdPrice2, dolarBlue?.venta);
                    return order === 'ascend' ? arsA - arsB : arsB - arsA;
                    
                case 'stock':
                    return order === 'ascend' ? a.stock - b.stock : b.stock - a.stock;
                    
                case 'category':
                    const catA = a.category?.name || "";
                    const catB = b.category?.name || "";
                    return order === 'ascend' 
                        ? catA.localeCompare(catB) 
                        : catB.localeCompare(catA);
                    
                default:
                    return 0;
            }
        });
        
        // Finalmente aplicamos paginación
        return sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    };

    // Definición de las columnas
    const columns: ColumnsType<Product> = [
        {
            title: "ID",
            dataIndex: "id",
            key: "id",
            width: 80,
            sorter: true,
        },
        {
            title: "Nombre",
            dataIndex: "name",
            key: "name",
            width: 200,
            sorter: true,
        },
        {
            title: "Costo",
            dataIndex: "price",
            key: "cost",
            width: 100,
            sorter: true,
            render: (price: number | string | undefined) => {
                if (price === null || price === undefined) return '-';
                // Convertir a número si viene como string
                const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
                // Verificar si es un número válido
                return !isNaN(numericPrice)
                    ? <Text strong style={{ color: '#000' }}>U$ {numericPrice.toFixed(2)}</Text>
                    : '-';
            }
        },
        {
            title: "Precio USD",
            key: "price_usd",
            width: 120,
            sorter: true,
            render: (_, record) => {
                // Convertir price a número si es string
                const numericPrice = typeof record.price === 'string' ? parseFloat(record.price) : record.price;

                if (isNaN(numericPrice)) return <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>-</Text>;

                const usdPrice = calculateUsdPrice(
                    numericPrice,
                    record.category?.profit_margin,
                    defaultProfitMargin
                );
                return <Text style={{ color: '#1890ff', fontWeight: 'bold' }}>{formatUsdPrice(usdPrice)}</Text>;
            },
        },
        {
            title: "Precio ARS",
            key: "price_ars",
            width: 120,
            sorter: true,
            render: (_, record) => {
                // Convertir price a número si es string
                const numericPrice = typeof record.price === 'string' ? parseFloat(record.price) : record.price;

                if (isNaN(numericPrice)) return <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>-</Text>;

                const usdPrice = calculateUsdPrice(
                    numericPrice,
                    record.category?.profit_margin,
                    defaultProfitMargin
                );
                return <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>{formatArsPrice(calculateArsPrice(usdPrice, dolarBlue?.venta))}</Text>;
            },
        },
        {
            title: "Stock",
            dataIndex: "stock",
            key: "stock",
            width: 100,
            sorter: true,
        },
        {
            title: "Categoría",
            key: "category",
            width: 150,
            sorter: true,
            render: (_, record) => record.category?.name || "-",
        },
        {
            title: "Imagen",
            key: "image",
            width: 100,
            render: (_, record) => (
                <div style={{ width: 80, height: 80, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {record.image ? (
                        <Image
                            src={record.image}
                            alt={record.name}
                            width={80}
                            height={80}
                            style={{
                                objectFit: 'cover',
                                borderRadius: '4px'
                            }}
                            fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2Q5ZDlkOSI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+"
                        />
                    ) : (
                        <div style={{
                            width: 80,
                            height: 80,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#f5f5f5',
                            borderRadius: '4px'
                        }}>
                            <PlusOutlined style={{ color: '#d9d9d9' }} />
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: "Acciones",
            key: "actions",
            width: 150,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Editar">
                        <Button
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => showModal(true, record)}
                        />
                    </Tooltip>
                    <Tooltip title="Eliminar">
                        <Popconfirm
                            title="¿Estás seguro de eliminar este producto?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Sí"
                            cancelText="No"
                            placement="left"
                        >
                            <Button
                                icon={<DeleteOutlined />}
                                size="small"
                                danger
                            />
                        </Popconfirm>
                    </Tooltip>
                </Space>
            ),
        },
    ];

    const uploadButton = (
        <div>
            {uploading ? <LoadingOutlined /> : <PlusOutlined />}
            <div style={{ marginTop: 8 }}>Subir</div>
        </div>
    );

    // Función para manejar la actualización de categorías en masa
    const handleBulkCategoryUpdate = async () => {
        if (!bulkCategoryId) {
            message.error("Por favor seleccione una categoría");
            return;
        }

        setIsBulkLoading(true);
        try {
            const response = await fetch("/api/products/bulk", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "update",
                    ids: selectedRowKeys,
                    data: {
                        category_id: bulkCategoryId
                    }
                }),
            });

            if (!response.ok) {
                throw new Error("Error al actualizar las categorías");
            }

            const result = await response.json();
            message.success(result.message);

            // Actualizar la lista de productos
            await fetchProducts();

            // Limpiar selecciones
            setSelectedRowKeys([]);
            setBulkCategoryModalOpen(false);
            setBulkCategoryId(null);
            setBulkCategoryName("");
        } catch (error) {
            console.error("Error en actualización masiva:", error);
            message.error("Error al actualizar las categorías");
        } finally {
            setIsBulkLoading(false);
        }
    };

    // Función para manejar la eliminación en masa
    const handleBulkDelete = async () => {
        setIsBulkLoading(true);
        try {
            const response = await fetch("/api/products/bulk", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "delete",
                    ids: selectedRowKeys
                }),
            });

            if (!response.ok) {
                throw new Error("Error al eliminar los productos");
            }

            const result = await response.json();
            message.success(result.message);

            // Actualizar la lista de productos
            await fetchProducts();

            // Limpiar selecciones
            setSelectedRowKeys([]);
        } catch (error) {
            console.error("Error en eliminación masiva:", error);
            message.error("Error al eliminar los productos");
        } finally {
            setIsBulkLoading(false);
        }
    };

    // Configuración para la selección de filas
    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
        selections: [
            {
                key: 'all-data',
                text: 'Seleccionar todos los productos',
                onSelect: () => {
                    const allKeys = products.map(item => item.id);
                    setSelectedRowKeys(allKeys);
                }
            },
            {
                key: 'clear-all',
                text: 'Desmarcar todo',
                onSelect: () => {
                    setSelectedRowKeys([]);
                }
            }
        ]
    };

    return (
        <div style={{
            height: 'calc(100vh - 64px)',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box'
        }}>

            <Card 
                title={<Title style={{ margin: 0 }} level={3}>Gestión de productos</Title>}
                style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden',
                    maxHeight: 'calc(100vh - 112px)'
                }}
                styles={{
                    body: { 
                        flex: 1, 
                        padding: '16px', 
                        overflow: 'hidden',
                        display: 'flex', 
                        flexDirection: 'column' 
                    }
                }}
                actions={[
                    <div key="pagination" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                        <Pagination 
                            total={products.filter(product =>
                                searchText === "" ||
                                product.name.toLowerCase().includes(searchText.toLowerCase())
                            ).length}
                            showTotal={(total) => `Total ${total} productos`}
                            current={currentPage}
                            onChange={handlePageChange}
                            pageSize={pageSize}
                            showSizeChanger={false}
                        />
                    </div>
                ]}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Input
                            placeholder="Buscar por nombre"
                            value={searchText}
                            onChange={(e) => {
                                if (isMounted.current) {
                                    setSearchText(e.target.value);
                                }
                            }}
                            style={{ width: 250 }}
                            prefix={<SearchOutlined />}
                            ref={searchInputRef}
                        />
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => showModal()}
                        >
                            Nuevo Producto
                        </Button>

                        {selectedRowKeys.length > 0 && (
                            <>
                                <Button
                                    onClick={() => setBulkCategoryModalOpen(true)}
                                    icon={<EditOutlined />}
                                >
                                    Editar Categorías ({selectedRowKeys.length})
                                </Button>
                                
                                <Popconfirm
                                    title="¿Estás seguro de eliminar estos productos?"
                                    description={`Se eliminarán ${selectedRowKeys.length} productos permanentemente`}
                                    onConfirm={handleBulkDelete}
                                    okText="Sí"
                                    cancelText="No"
                                >
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                    >
                                        Eliminar ({selectedRowKeys.length})
                                    </Button>
                                </Popconfirm>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <Table
                        rowSelection={rowSelection}
                        columns={columns.map(col => ({
                            ...col,
                            sortOrder: sortedInfo.columnKey === col.key ? sortedInfo.order : null,
                        }))}
                        dataSource={getTableData()}
                        rowKey="id"
                        loading={loading}
                        pagination={false}
                        scroll={{ y: 'calc(100vh - 370px)', scrollToFirstRowOnChange: true }}
                        style={{ height: '100%' }}
                        className="products-table"
                        onChange={handleTableChange}
                        tableLayout="fixed"
                    />
                </div>
            </Card>

            {/* Modal para agregar/editar productos */}
            <Modal
                title={isEditing ? "Editar Producto" : "Nuevo Producto"}
                open={isModalOpen}
                onOk={handleSubmit}
                onCancel={handleCancel}
                confirmLoading={isSubmitting}
                width={800}
            >
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={10}>
                            <Form.Item label="Imagen del Producto">
                                <div style={{ marginBottom: 16 }}>
                                    {imageUrl && (
                                        <div style={{ marginBottom: 16, textAlign: 'center' }}>
                                            <Image
                                                src={imageUrl}
                                                alt="Imagen del producto"
                                                style={{ 
                                                    maxWidth: '100%', 
                                                    maxHeight: '200px',
                                                    objectFit: 'contain' 
                                                }}
                                            />
                                            <Button 
                                                type="text" 
                                                danger 
                                                icon={<CloseCircleOutlined />} 
                                                onClick={handleRemoveImage}
                                                style={{ marginTop: 8 }}
                                            >
                                                Eliminar imagen
                                            </Button>
                                        </div>
                                    )}
                                    <Form.Item name="imageUpload" valuePropName="fileList" getValueFromEvent={normFile} noStyle>
                                        <Dragger 
                                            {...uploadProps}
                                            fileList={fileList}
                                            onChange={handleFileChange}
                                            disabled={!!imageUrl || fileList.length > 0}
                                        >
                                            {uploadButton}
                                        </Dragger>
                                    </Form.Item>
                                </div>
                                {(!imageUrl && fileList.length === 0) && (
                                    <div style={{ marginTop: 8 }}>
                                        <Form.Item 
                                            name="imageUrl" 
                                            label="O ingresa la URL de una imagen" 
                                            style={{ marginBottom: 0 }}
                                            noStyle
                                        >
                                            <Input
                                                placeholder="https://ejemplo.com/imagen.jpg"
                                                suffix={
                                                    <Tooltip title="Ingresa la URL de una imagen externa">
                                                        <InfoCircleOutlined style={{ color: 'rgba(0,0,0,.45)' }} />
                                                    </Tooltip>
                                                }
                                                disabled={!!imageUrl || fileList.length > 0}
                                                addonAfter={
                                                    <Button 
                                                        type="text" 
                                                        icon={<LinkOutlined />} 
                                                        onClick={() => {
                                                            const url = form.getFieldValue('imageUrl');
                                                            if (url) {
                                                                setImageUrl(url);
                                                            }
                                                        }}
                                                        disabled={!!imageUrl || fileList.length > 0}
                                                    />
                                                }
                                            />
                                        </Form.Item>
                                        <div style={{ marginTop: 4 }}>
                                            <Text type="secondary">O ingresa la URL de una imagen</Text>
                                        </div>
                                    </div>
                                )}
                            </Form.Item>
                        </Col>

                        <Col span={14}>
                            <Form.Item
                                label="Nombre"
                                name="name"
                                rules={[{ required: true, message: 'Por favor ingrese el nombre del producto' }]}
                            >
                                <Input />
                            </Form.Item>

                            {/* Campo para la categoría */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ marginBottom: 8 }}>
                                    <label htmlFor="category">Categoría</label>
                                </div>
                                <AutoComplete
                                    value={selectedCategoryName}
                                    style={{ width: '100%' }}
                                    options={categories.map(c => ({ value: c.name }))}
                                    placeholder="Seleccione o busque una categoría"
                                    onChange={(value) => {
                                        setSelectedCategoryName(value);
                                        
                                        // Buscar la categoría para obtener su ID y margen
                                        const category = categories.find(c => c.name === value);
                                        if (category) {
                                            form.setFieldsValue({ category_id: category.id });
                                            
                                            // Actualizar el margen de la categoría seleccionada
                                            const categoryMargin = getCategoryMargin(category.id);
                                            setSelectedCategoryMargin(categoryMargin);
                                            
                                            // Actualizar precios calculados
                                            updateCalculatedPrices();
                                        } else {
                                            form.setFieldsValue({ category_id: null });
                                            setSelectedCategoryMargin(defaultProfitMargin);
                                        }
                                    }}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                                    }
                                />
                                <Form.Item name="category_id" hidden>
                                    <InputNumber />
                                </Form.Item>
                            </div>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        label={
                                            <span>
                                                Precio Base (USD) 
                                                <Tooltip title="El precio base en dólares, sin incluir el margen de ganancia">
                                                    <InfoCircleOutlined style={{ marginLeft: 8 }} />
                                                </Tooltip>
                                            </span>
                                        }
                                        name="price"
                                        rules={[{ required: true, message: 'Por favor ingrese el precio base' }]}
                                    >
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            precision={2}
                                            formatter={value => `$ ${value}`}
                                            onChange={() => updateCalculatedPrices()}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        label={
                                            <span>
                                                Stock 
                                                <Tooltip title="Cantidad disponible del producto">
                                                    <InfoCircleOutlined style={{ marginLeft: 8 }} />
                                                </Tooltip>
                                            </span>
                                        }
                                        name="stock"
                                        rules={[{ required: true, message: 'Por favor ingrese el stock' }]}
                                    >
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            min={0}
                                            precision={0}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>

                            {/* Precios calculados */}
                            <div style={{ 
                                padding: '12px 16px', 
                                background: '#f5f5f5', 
                                borderRadius: '4px',
                                marginBottom: 16
                            }}>
                                <div style={{ marginBottom: 8 }}>
                                    <Text>Cálculo de precios estimados:</Text>
                                </div>
                                <Row gutter={16}>
                                    <Col span={12}>
                                        <div style={{ marginBottom: 8 }}>
                                            <Text type="secondary">Margen de ganancia:</Text>
                                        </div>
                                        <div>
                                            <Text strong>{formatProfitMargin(selectedCategoryMargin)}</Text>
                                        </div>
                                    </Col>
                                    <Col span={12}>
                                        <div style={{ marginBottom: 8 }}>
                                            <Text type="secondary">
                                                Precio de venta USD:
                                            </Text>
                                        </div>
                                        <div>
                                            <Text strong>
                                                {calculatedUsdPrice !== null 
                                                    ? formatUsdPrice(calculatedUsdPrice) 
                                                    : '-'}
                                            </Text>
                                        </div>
                                    </Col>
                                </Row>
                                <Row gutter={16} style={{ marginTop: 12 }}>
                                    <Col span={24}>
                                        <div style={{ marginBottom: 4 }}>
                                            <Text type="secondary">
                                                Precio estimado en ARS:
                                            </Text>
                                        </div>
                                        <div>
                                            <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                                                {calculatedArsPrice !== null && dolarBlue 
                                                    ? formatArsPrice(calculatedArsPrice) 
                                                    : '-'}
                                            </Text>
                                            {dolarBlue && (
                                                <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                                                    (Cotización: {formatArsPrice(dolarBlue.venta)})
                                                </Text>
                                            )}
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Modal para actualizar categorías en masa */}
            <Modal
                title="Actualizar categorías"
                open={bulkCategoryModalOpen}
                onOk={handleBulkCategoryUpdate}
                onCancel={() => setBulkCategoryModalOpen(false)}
                confirmLoading={isBulkLoading}
            >
                <div style={{ marginBottom: 16 }}>
                    <p>Se actualizarán {selectedRowKeys.length} productos.</p>
                </div>
                
                <div>
                    <AutoComplete
                        value={bulkCategoryName}
                        style={{ width: '100%' }}
                        options={categories.map(c => ({ value: c.name, id: c.id }))}
                        placeholder="Seleccione o busque una categoría"
                        onChange={(value) => setBulkCategoryName(value)}
                        onSelect={(value, option: any) => {
                            setBulkCategoryId(option.id);
                            setBulkCategoryName(value);
                        }}
                        filterOption={(inputValue, option) =>
                            option!.value.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                        }
                    />
                </div>
            </Modal>
        </div>
    );
}