"use client";

import { AutoComplete, Button, Card, Col, Divider, Form, Input, InputNumber, Popconfirm, Row, Select, Spin, Table, Typography, Upload, Image, message } from "antd";
import { DeleteOutlined, PlusOutlined, SendOutlined, UploadOutlined, InboxOutlined, LinkOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useEffect, useState, useRef, createRef } from "react";
import { toaster } from "../components/ui/toaster";
import type { InputRef } from 'antd/es/input';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import type { RcFile } from 'rc-upload/lib/interface';
import { useRouter } from "next/navigation";

const { Text, Title } = Typography;
const { Option } = Select;

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
    [key: string]: number | string | undefined | null; // Índice de firma para permitir acceso dinámico
};

export default function PedidosPage() {
    const router = useRouter();
    const [products, setProducts] = useState<OrderProduct[]>([{ quantity: 0, name: "", cost: 0, supplier: "", imageUrl: "", categoryId: null, categoryName: "" }]);
    const [shippingCost, setShippingCost] = useState(0);
    const [proratedCosts, setProratedCosts] = useState<any[]>([]);
    const [existingProducts, setExistingProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form] = Form.useForm();
    
    // Estados para gestión de imágenes
    const [fileList, setFileList] = useState<UploadFile[][]>([]);
    const [imageUrls, setImageUrls] = useState<(string | null)[]>([]);
    
    // Referencias para los campos de cantidad usando un array de refs
    const [quantityRefs, setQuantityRefs] = useState<React.RefObject<any>[]>([]);

    // Actualizar las referencias cuando cambian los productos
    useEffect(() => {
        // Crear nuevas referencias para cada producto
        const newRefs = Array(products.length).fill(0).map((_, i) => {
            // Conservar la referencia existente si es posible
            return quantityRefs[i] || createRef();
        });
        setQuantityRefs(newRefs);
        
        // Expandir los arrays para gestión de imágenes si es necesario
        if (fileList.length < products.length) {
            setFileList(prev => [...prev, ...Array(products.length - prev.length).fill([])]);
        }
        if (imageUrls.length < products.length) {
            setImageUrls(prev => [...prev, ...Array(products.length - prev.length).fill(null)]);
        }
    }, [products.length]);

    // Efecto específico para establecer el foco cuando se agrega un producto nuevo
    useEffect(() => {
        // Si se agregó un nuevo producto (length aumentó)
        if (products.length > 1 && quantityRefs.length === products.length) {
            const lastIndex = products.length - 1;
            // Intentar establecer el foco varias veces con intervalos cortos
            const focusAttempts = [10, 50, 100, 200];
            
            focusAttempts.forEach(delay => {
                setTimeout(() => {
                    if (quantityRefs[lastIndex]?.current) {
                        quantityRefs[lastIndex].current.focus();
                    }
                }, delay);
            });
        }
    }, [products.length, quantityRefs.length]);

    // Estilos globales para el componente
    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
            .category-autocomplete {
                min-height: 32px !important;
                width: 100% !important;
            }
            .category-autocomplete .ant-select-selector {
                height: 32px !important;
                padding: 0 11px !important;
                display: flex;
                align-items: center;
            }
            .category-autocomplete .ant-select-selection-placeholder {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                line-height: normal !important;
            }
            .category-autocomplete .ant-select-selection-item {
                line-height: normal !important;
                display: flex;
                align-items: center;
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Cargar productos existentes y categorías
    useEffect(() => {
        Promise.all([
            fetch('/api/products').then(res => res.json()),
            fetch('/api/categories').then(res => res.json())
        ])
        .then(([productsData, categoriesData]) => {
            setExistingProducts(productsData);
            setCategories(categoriesData);
        })
        .catch(error => {
            console.error(error);
            toaster.error('Error al cargar los datos');
        });
    }, []);

    // Manejar selección de producto
    const handleSelectProduct = (productName: string, index: number) => {
        const product = existingProducts.find(p => p.name === productName);
        if (!product) return;

        const newProducts = [...products];
        const category = product.category_id ? categories.find(c => c.id === product.category_id) : null;
        
        newProducts[index] = {
            ...newProducts[index],
            name: product.name,
            cost: product.price,
            categoryId: product.category_id,
            categoryName: category ? category.name : "",
        };
        setProducts(newProducts);
    };

    // Manejar selección de categoría
    const handleCategoryChange = (value: string, index: number) => {
        const newProducts = [...products];
        
        if (!value) {
            // Si se deselecciona la categoría
            newProducts[index].categoryId = null;
            newProducts[index].categoryName = "";
        } else {
            // Buscar si existe la categoría por nombre
            const existingCategory = categories.find(c => c.name.toLowerCase() === value.toLowerCase());
            
            if (existingCategory) {
                // Si es una categoría existente
                newProducts[index].categoryId = existingCategory.id;
                newProducts[index].categoryName = existingCategory.name;
            } else {
                // Si es una nueva categoría (texto)
                newProducts[index].categoryId = null;
                newProducts[index].categoryName = value;
            }
        }
        
        setProducts(newProducts);
    };

    const addProduct = () => {
        // Añadir un nuevo producto al final
        setProducts([...products, { quantity: 0, name: "", cost: 0, supplier: "", imageUrl: "", categoryId: null, categoryName: "" }]);
        
        // El foco se manejará automáticamente por el useEffect
    };

    const removeProduct = (index: number) => {
        const newProducts = [...products];
        newProducts.splice(index, 1);
        setProducts(newProducts);
    };

    const handleChange = (value: any, index: number, field: string) => {
        const newProducts = [...products];
        if (field === "quantity" || field === "cost") {
            // Formatear a 2 decimales para los campos numéricos
            let numValue = typeof value === 'number' ? value : 0;
            
            // Para el campo de costo, formatear a 2 decimales
            if (field === "cost") {
                numValue = Number(numValue.toFixed(2));
            }
            
            newProducts[index][field] = numValue;
        } else {
            newProducts[index][field] = value;
            
            // Si se está cambiando el campo categoryName manualmente
            if (field === "categoryName") {
                // Buscar si existe la categoría por nombre
                const existingCategory = categories.find(c => c.name.toLowerCase() === value.toLowerCase());
                
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
    };

    const handleShippingCostChange = (value: number | null) => {
        setShippingCost(value || 0);
    };

    const calculateProratedCosts = () => {
        const totalProductCost = products.reduce((acc, product) => acc + (product.quantity * product.cost), 0);
        if (totalProductCost === 0) {
            setProratedCosts(products.map(() => ({ proratedShippingCost: 0, totalCost: 0, unitCostWithShipping: 0 })));
            return;
        }
        const prorated = products.map((product) => {
            const productTotalCost = product.quantity * product.cost;
            const proratedShipping = (productTotalCost / totalProductCost) * shippingCost;
            const totalCost = productTotalCost + proratedShipping;
            // Cálculo del costo unitario incluyendo el envío prorrateado
            const unitCostWithShipping = product.quantity > 0 
                ? (product.cost + (proratedShipping / product.quantity))
                : 0;

            // Convertir a número y validar que no sea NaN
            const validProratedShipping = Number(proratedShipping);
            const validTotalCost = Number(totalCost);
            const validUnitCostWithShipping = Number(unitCostWithShipping);
            
            // Asegurémonos de que todos son valores numéricos, reemplazando NaN por 0
            return { 
                proratedShippingCost: isNaN(validProratedShipping) ? 0 : validProratedShipping, 
                totalCost: isNaN(validTotalCost) ? 0 : validTotalCost,
                unitCostWithShipping: isNaN(validUnitCostWithShipping) ? 0 : validUnitCostWithShipping
            };
        });
        setProratedCosts(prorated);
    };

    useEffect(() => {
        calculateProratedCosts();
    }, [products, shippingCost]);

    // Modificamos las columnas para manejar posibles valores no numéricos
    const formatNumberOrZero = (value: any) => {
        const num = Number(value);
        return !isNaN(num) ? num.toFixed(2) : "0.00";
    };

    // Funciones de ayuda para el InputNumber
    // @ts-ignore - Ignoramos el error de tipo porque sabemos que el componente funciona correctamente
    const formatCurrency = (value: number | undefined | null): string => {
        if (value === undefined || value === null) return "$ 0";
        return `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    };
    
    // @ts-ignore - Ignoramos el error de tipo porque sabemos que el componente funciona correctamente
    const parseCurrency = (value: string | undefined): number => {
        if (!value || typeof value !== 'string') return 0;
        return parseFloat(value.replace(/\$\s?|(,*)/g, '')) || 0;
    };

    // Manejar el keyDown para detectar Enter
    const handleKeyDown = (e: React.KeyboardEvent, index: number, field: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            // Si es el último producto, agregar uno nuevo sin importar el campo
            if (index === products.length - 1) {
                addProduct();
            } else {
                // Si no es el último producto, pasar al campo de cantidad del siguiente producto
                if (quantityRefs[index + 1] && quantityRefs[index + 1].current) {
                    quantityRefs[index + 1].current.focus();
                }
            }
        }
    };

    const handleSubmit = async () => {
        // Validar los productos antes de enviar
        if (products.length === 0 || products.every(p => p.quantity === 0)) {
            toaster.error("Debe agregar al menos un producto con cantidad");
            return;
        }

        setIsSubmitting(true);
        
        try {
            // Procesar imágenes si hay archivos adjuntos
            const productsWithImages = await Promise.all(
                products.filter(p => p.quantity > 0 && p.name).map(async (product, index) => {
                    // Si hay un archivo para subir
                    if (fileList[index]?.length > 0 && fileList[index][0].originFileObj) {
                        const formData = new FormData();
                        formData.append('file', fileList[index][0].originFileObj);
                        // Usamos un ID temporal basado en el índice y timestamp para identificar la imagen
                        const tempProductId = `temp-${index}-${Date.now()}`;
                        formData.append('productId', tempProductId);
                        
                        try {
                            const response = await fetch('/api/images', {
                                method: 'POST',
                                body: formData
                            });
                            
                            if (response.ok) {
                                const result = await response.json();
                                return {
                                    ...product,
                                    imageUrl: result.url,
                                    proratedShippingCost: proratedCosts[products.indexOf(product)]?.proratedShippingCost.toFixed(2) || 0,
                                    totalCost: proratedCosts[products.indexOf(product)]?.totalCost.toFixed(2) || 0,
                                    finalUnitCost: proratedCosts[products.indexOf(product)]?.unitCostWithShipping.toFixed(2) || 0,
                                };
                            }
                        } catch (error) {
                            console.error('Error al subir la imagen:', error);
                        }
                    }
                    // Si hay una URL de imagen externa
                    else if (product.imageUrl && (product.imageUrl.startsWith('http://') || product.imageUrl.startsWith('https://'))) {
                        try {
                            // Usamos un ID temporal basado en el índice y timestamp
                            const tempProductId = `temp-${index}-${Date.now()}`;
                            
                            const response = await fetch('/api/images', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    url: product.imageUrl,
                                    productId: tempProductId
                                })
                            });
                            
                            if (response.ok) {
                                const result = await response.json();
                                return {
                                    ...product,
                                    imageUrl: result.url,
                                    proratedShippingCost: proratedCosts[products.indexOf(product)]?.proratedShippingCost.toFixed(2) || 0,
                                    totalCost: proratedCosts[products.indexOf(product)]?.totalCost.toFixed(2) || 0,
                                    finalUnitCost: proratedCosts[products.indexOf(product)]?.unitCostWithShipping.toFixed(2) || 0,
                                };
                            }
                        } catch (error) {
                            console.error('Error al procesar la URL de la imagen:', error);
                        }
                    }
                    
                    // Si no hay imagen o hubo un error procesando la imagen
                    return {
                        ...product,
                        proratedShippingCost: proratedCosts[products.indexOf(product)]?.proratedShippingCost.toFixed(2) || 0,
                        totalCost: proratedCosts[products.indexOf(product)]?.totalCost.toFixed(2) || 0,
                        finalUnitCost: proratedCosts[products.indexOf(product)]?.unitCostWithShipping.toFixed(2) || 0,
                    };
                })
            );

            const response = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    products: productsWithImages,
                }),
            });
            
            if (!response.ok) {
                const error = await response.json();
                toaster.error("Error: " + error.error);
                return;
            }
            
            const result = await response.json();
            toaster.success(result.message);
            setProducts([{ quantity: 0, name: "", cost: 0, supplier: "", imageUrl: "", categoryId: null, categoryName: "" }]);
            setShippingCost(0);
            setFileList([[]]);
            setImageUrls([null]);
        } catch (error: any) {
            toaster.error("Error al enviar los datos: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Función para manejar la subida de archivos
    const handleFileChange = (info: any, index: number) => {
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
            newProducts[index].imageUrl = '';
            setProducts(newProducts);
            return;
        }

        // Si hay un archivo, establecer la URL de previsualización
        if (newFileList.length > 0) {
            const lastFile = newFileList[newFileList.length - 1];
            if (lastFile.originFileObj) {
                // Crear objeto URL para previsualización
                const objectUrl = URL.createObjectURL(lastFile.originFileObj);
                
                // Actualizar la URL de imagen para este índice
                const newImageUrls = [...imageUrls];
                newImageUrls[index] = objectUrl;
                setImageUrls(newImageUrls);
                
                // Actualizar el producto
                const newProducts = [...products];
                newProducts[index].imageUrl = objectUrl;
                setProducts(newProducts);
            }
        }
    };

    // Función para manejar la URL de imagen
    const handleImageUrl = (url: string, index: number) => {
        if (!url) return;
        
        // Verificar si es una URL externa
        if (url.startsWith('http://') || url.startsWith('https://')) {
            // Mostrar mensaje de carga
            message.loading({ content: 'Procesando imagen...', key: `image-${index}` });
            
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
                    productId: tempProductId
                })
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
                newProducts[index].imageUrl = result.url;
                setProducts(newProducts);
                
                // Actualizar la URL de previsualización
                const newImageUrls = [...imageUrls];
                newImageUrls[index] = result.url;
                setImageUrls(newImageUrls);
                
                // Limpiar archivos si había
                const newFileListArray = [...fileList];
                newFileListArray[index] = [];
                setFileList(newFileListArray);
                
                // Mostrar mensaje de éxito
                message.success({ content: 'Imagen procesada correctamente', key: `image-${index}` });
            })
            .catch(error => {
                console.error('Error al procesar la URL de la imagen:', error);
                message.error({ content: 'Error al procesar la imagen', key: `image-${index}` });
                
                // Aún así, guardar la URL original para que el usuario pueda intentar de nuevo
                const newProducts = [...products];
                newProducts[index].imageUrl = url;
                setProducts(newProducts);
            });
        } else {
            // Si no es una URL externa, simplemente actualizar los estados
            // Actualizar el producto
            const newProducts = [...products];
            newProducts[index].imageUrl = url;
            setProducts(newProducts);
            
            // Limpiar archivos si había
            const newFileListArray = [...fileList];
            newFileListArray[index] = [];
            setFileList(newFileListArray);
            
            // Establecer la URL de previsualización
            const newImageUrls = [...imageUrls];
            newImageUrls[index] = url;
            setImageUrls(newImageUrls);
        }
    };

    // Configuración para Upload
    const uploadProps: UploadProps = {
        accept: "image/*",
        beforeUpload: (file: RcFile) => {
            // Validar tipo de archivo
            const isImage = file.type.indexOf('image/') === 0;
            if (!isImage) {
                message.error('¡Solo puedes subir imágenes!');
            }
            
            // Validar tamaño (máximo 5MB)
            const isLessThan5M = file.size / 1024 / 1024 < 5;
            if (!isLessThan5M) {
                message.error('¡La imagen debe ser menor a 5MB!');
            }
            
            // No subir automáticamente
            return false;
        },
        showUploadList: true,
        maxCount: 1
    };

    const columns = [
        {
            title: 'Cantidad',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 90,
            render: (_: any, _record: any, index: number) => (
                <InputNumber
                    min={0}
                    value={products[index].quantity}
                    onChange={(value) => handleChange(value, index, "quantity")}
                    placeholder="Cantidad"
                    ref={quantityRefs[index]}
                    onKeyDown={(e) => handleKeyDown(e, index, 'quantity')}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Nombre Producto',
            dataIndex: 'name',
            key: 'name',
            width: 220,
            render: (_: any, _record: any, index: number) => (
                <AutoComplete
                    style={{ width: '100%' }}
                    placeholder="Nombre del producto"
                    value={products[index].name}
                    options={existingProducts.map(product => ({
                        value: product.name,
                        label: `${product.name} ($${product.price})`,
                    }))}
                    onChange={(value) => handleChange(value, index, "name")}
                    onSelect={(value) => handleSelectProduct(value, index)}
                    filterOption={(inputValue, option) =>
                        option?.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                    }
                    onKeyDown={(e) => handleKeyDown(e, index, 'name')}
                />
            )
        },
        {
            title: 'Categoría',
            dataIndex: 'category',
            key: 'category',
            width: 160,
            render: (_: any, _record: any, index: number) => {
                // Usar el nombre de la categoría para mostrar
                const displayValue = products[index].categoryName || "";
                
                // Categorías existentes como opciones para el AutoComplete
                return (
                    <div style={{ width: '100%', minHeight: '32px' }}>
                        <AutoComplete
                            style={{ width: '100%' }}
                            placeholder="Selecciona o escribe una categoría"
                            value={displayValue}
                            options={categories.map(cat => ({
                                value: cat.name,
                                label: cat.name,
                            }))}
                            onChange={(value) => handleChange(value, index, "categoryName")}
                            filterOption={(inputValue, option) =>
                                option?.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                            }
                            onSelect={(value) => handleCategoryChange(value, index)}
                            onKeyDown={(e) => handleKeyDown(e, index, 'categoryName')}
                            className="category-autocomplete"
                            popupMatchSelectWidth={true}
                        />
                    </div>
                );
            }
        },
        {
            title: 'Costo',
            dataIndex: 'cost',
            key: 'cost',
            width: 110,
            render: (_: any, _record: any, index: number) => (
                <InputNumber
                    min={0}
                    step={0.01}
                    value={products[index].cost}
                    onChange={(value) => handleChange(value, index, "cost")}
                    placeholder="Costo"
                    formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value): number => parseCurrency(value)}
                    onKeyDown={(e) => handleKeyDown(e, index, 'cost')}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Proveedor',
            dataIndex: 'supplier',
            key: 'supplier',
            width: 140,
            render: (_: any, _record: any, index: number) => (
                <Input
                    value={products[index].supplier}
                    onChange={(e) => handleChange(e.target.value, index, "supplier")}
                    placeholder="Proveedor"
                    onKeyDown={(e) => handleKeyDown(e, index, 'supplier')}
                />
            )
        },
        {
            title: 'Imagen',
            dataIndex: 'imageUrl',
            key: 'imageUrl',
            width: 160,
            render: (_: any, _record: any, index: number) => (
                <div>
                    {imageUrls[index] ? (
                        <div style={{ marginBottom: 8, textAlign: 'center' }}>
                            <Image
                                src={imageUrls[index] || ''}
                                alt="Imagen del producto"
                                style={{ 
                                    width: '60px', 
                                    height: '60px',
                                    objectFit: 'cover',
                                    borderRadius: '4px'
                                }}
                                preview={{
                                    mask: (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <PlusOutlined />
                                            <span>Ver</span>
                                        </div>
                                    )
                                }}
                            />
                            <Button 
                                type="text" 
                                danger 
                                icon={<CloseCircleOutlined />} 
                                onClick={() => handleImageUrl('', index)}
                                style={{ marginLeft: 8 }}
                                size="small"
                            />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <Input
                                placeholder="URL de imagen"
                                value={products[index].imageUrl}
                                onChange={(e) => handleChange(e.target.value, index, "imageUrl")}
                                onKeyDown={(e) => handleKeyDown(e, index, 'imageUrl')}
                                style={{ flexGrow: 1 }}
                                addonAfter={
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <Button 
                                            type="text" 
                                            icon={<LinkOutlined />} 
                                            onClick={() => handleImageUrl(products[index].imageUrl, index)}
                                            size="small"
                                            style={{ padding: 0, margin: 0 }}
                                        />
                                        <Upload
                                            {...uploadProps}
                                            fileList={fileList[index] || []}
                                            onChange={(info) => handleFileChange(info, index)}
                                            showUploadList={false}
                                        >
                                            <Button 
                                                type="text" 
                                                icon={<UploadOutlined />} 
                                                size="small"
                                                style={{ padding: 0, margin: 0 }}
                                            />
                                        </Upload>
                                    </div>
                                }
                            />
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Envío Prorrateado',
            dataIndex: 'proratedShippingCost',
            key: 'proratedShippingCost',
            width: 80,
            render: (_: any, _record: any, index: number) => (
                <Text>$ {formatNumberOrZero(proratedCosts[index]?.proratedShippingCost)}</Text>
            )
        },
        {
            title: 'Precio Final Unitario',
            dataIndex: 'finalUnitCost',
            key: 'finalUnitCost',
            width: 90,
            render: (_: any, _record: any, index: number) => (
                <Text type="success">$ {formatNumberOrZero(proratedCosts[index]?.unitCostWithShipping)}</Text>
            )
        },
        {
            title: 'Total',
            dataIndex: 'totalCost',
            key: 'totalCost',
            width: 80,
            render: (_: any, _record: any, index: number) => (
                <Text strong>$ {formatNumberOrZero(proratedCosts[index]?.totalCost)}</Text>
            )
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 60,
            render: (_: any, _record: any, index: number) => (
                <Button
                    type="text"
                    danger
                    onClick={() => removeProduct(index)}
                    icon={<DeleteOutlined />}
                    style={{ display: products.length > 1 ? 'inline-block' : 'none' }}
                />
            )
        }
    ];

    return (
        <div style={{ 
            padding: 16, 
            height: "calc(100vh - 32px)", 
            display: "flex", 
            flexDirection: "column" 
        }}>
            
            <Card 
                title={<Title style={{ margin: 0 }} level={3}>Gestión de pedidos</Title>} 
                variant="outlined" 
                styles={{
                    body: { 
                        padding: '16px', 
                        height: '100%', 
                        display: 'flex', 
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }
                }}
                style={{ 
                    height: 'calc(100vh - 112px)',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <Form 
                    form={form} 
                    layout="vertical" 
                    style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '100%',
                        overflow: 'hidden'
                    }}
                >
                    {/* Área scrollable que ocupa el espacio disponible */}
                    <div style={{ 
                        flex: '1 1 auto',
                        position: 'relative',
                        overflow: 'hidden',
                        marginBottom: 16
                    }}>
                        <Table
                            dataSource={products.map((_, index) => ({ key: index }))}
                            columns={columns}
                            pagination={false}
                            bordered
                            scroll={{ 
                                x: 'max-content', 
                                y: 'calc(100vh - 510px)',
                                scrollToFirstRowOnChange: true
                            }}
                            style={{ height: '100%' }}
                            tableLayout="fixed"
                            sticky
                        />
                    </div>
                    
                    {/* Área fija en la parte inferior */}
                    <div style={{ 
                        flex: '0 0 auto', 
                        marginTop: 16, 
                        padding: '16px 0 0', 
                        borderTop: '1px solid #f0f0f0',
                        backgroundColor: '#fff', 
                        position: 'sticky',
                        bottom: 0,
                        zIndex: 5,
                        width: '100%',
                        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}>
                        <Button 
                            type="dashed" 
                            onClick={addProduct} 
                            icon={<PlusOutlined />}
                            style={{ width: '100%', marginBottom: 16 }}
                        >
                            Agregar Producto
                        </Button>
                    
                        <Form.Item label="Costo de Envío">
                            <InputNumber
                                min={0}
                                step={0.01}
                                value={shippingCost}
                                onChange={handleShippingCostChange}
                                style={{ width: 200 }}
                                formatter={formatCurrency}
                                parser={(value): number => parseCurrency(value)}
                            />
                        </Form.Item>
                        
                        <Form.Item>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                icon={<SendOutlined />}
                                disabled={products.length === 0 || products.every(p => p.quantity === 0) || isSubmitting}
                                loading={isSubmitting}
                            >
                                Enviar Pedido
                            </Button>
                        </Form.Item>
                    </div>
                </Form>
            </Card>
        </div>
    );
}