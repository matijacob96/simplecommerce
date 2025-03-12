import { NextResponse } from 'next/server';
import { updateUserRole, deleteUser } from '@/lib/auth';
import { UserRole } from '@/lib/auth';

// PATCH - Actualizar rol de usuario
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { role } = await request.json();
    
    if (!role) {
      return NextResponse.json({ error: 'Se requiere el rol' }, { status: 400 });
    }
    
    await updateUserRole(params.id, role as UserRole);
    
    return NextResponse.json({
      success: true,
      message: 'Rol de usuario actualizado correctamente'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Eliminar usuario
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteUser(params.id);
    
    return NextResponse.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 