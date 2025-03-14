import { NextResponse } from 'next/server';
import getSupabaseAdmin from '@/lib/supabase-server'; // Cliente con service_role
import { getErrorMessage } from '@/types/error-types';

// Nombre del bucket de Supabase Storage
const BUCKET_NAME = 'images-bucket';

// Función para procesar la subida de imágenes
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let productId: string | null = null;
    let file: File | null = null;
    let imageUrl: string | null = null;

    // Procesar FormData (para subidas de archivos)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      productId = formData.get('productId') as string;
      file = formData.get('file') as File;

      if (!productId) {
        return NextResponse.json({ error: 'Se requiere el ID del producto' }, { status: 400 });
      }

      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'Se requiere un archivo válido' }, { status: 400 });
      }

      // Obtener cliente supabaseAdmin solo cuando lo necesitamos
      const supabaseAdmin = getSupabaseAdmin();

      // Subir el archivo a Supabase Storage usando el cliente con service_role
      const { error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(`productos/${productId}`, file, {
          cacheControl: '604800',
          upsert: true,
        });

      if (error) {
        console.error('Error al subir la imagen:', error);
        return NextResponse.json(
          { error: `Error al subir la imagen: ${error.message}` },
          { status: 500 }
        );
      }

      // Obtener la URL pública con timestamp para forzar actualización de caché
      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(`productos/${productId}`);

      // Agregar timestamp como parámetro de consulta para forzar refresco de caché
      const timestamp = new Date().getTime();
      const urlWithTimestamp = `${publicUrl}?t=${timestamp}`;

      return NextResponse.json({ url: urlWithTimestamp });
    }
    // Procesar JSON (para URLs de imágenes)
    else if (contentType.includes('application/json')) {
      const { url, productId: id } = await request.json();
      productId = id;
      imageUrl = url;

      if (!productId) {
        return NextResponse.json({ error: 'Se requiere el ID del producto' }, { status: 400 });
      }

      if (!imageUrl || typeof imageUrl !== 'string') {
        return NextResponse.json(
          { error: 'Se requiere una URL de imagen válida' },
          { status: 400 }
        );
      }

      try {
        // Descargar la imagen desde la URL
        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
          throw new Error(`No se pudo descargar la imagen: ${imageResponse.statusText}`);
        }

        // Convertir a Blob
        const imageBlob = await imageResponse.blob();

        // Determinar el tipo MIME
        const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

        // Obtener cliente supabaseAdmin solo cuando lo necesitamos
        const supabaseAdmin = getSupabaseAdmin();

        // Subir directamente el Blob a Supabase usando el cliente con service_role
        const { error } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(`productos/${productId}`, imageBlob, {
            cacheControl: '604800',
            upsert: true,
            contentType: contentType,
          });

        if (error) {
          throw new Error(`Error al subir la imagen: ${error.message}`);
        }

        // Obtener la URL pública con timestamp para forzar actualización de caché
        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(`productos/${productId}`);

        // Agregar timestamp como parámetro de consulta para forzar refresco de caché
        const timestamp = new Date().getTime();
        const urlWithTimestamp = `${publicUrl}?t=${timestamp}`;

        return NextResponse.json({ url: urlWithTimestamp });
      } catch (error: unknown) {
        console.error('Error procesando la URL de la imagen:', error);
        return NextResponse.json(
          { error: getErrorMessage(error) || 'Error procesando la URL de la imagen' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json({ error: 'Tipo de contenido no soportado' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Error en la API de imágenes:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Error en la API de imágenes' },
      { status: 500 }
    );
  }
}

// Función para eliminar imágenes
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ error: 'Se requiere el ID del producto' }, { status: 400 });
    }

    // Obtener cliente supabaseAdmin solo cuando lo necesitamos
    const supabaseAdmin = getSupabaseAdmin();

    // Eliminar la imagen de Supabase Storage usando el cliente con service_role
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([`productos/${productId}`]);

    if (error) {
      console.error('Error al eliminar la imagen:', error);
      return NextResponse.json(
        { error: `Error al eliminar la imagen: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Imagen eliminada correctamente' });
  } catch (error: unknown) {
    console.error('Error al eliminar la imagen:', error);
    return NextResponse.json(
      { error: getErrorMessage(error) || 'Error al eliminar la imagen' },
      { status: 500 }
    );
  }
}
