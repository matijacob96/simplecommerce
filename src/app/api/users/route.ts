import { NextResponse } from 'next/server';
import { getAllUsers, createUser, updateUserRole, deleteUser } from '@/lib/auth';
import { UserRole } from '@/lib/auth';

// GET - Obtener todos los usuarios
export async function GET() {
  try {
    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Crear un nuevo usuario
export async function POST(request: Request) {
  try {
    const { email, password, role } = await request.json();
    
    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Se requieren email, contraseña y rol' }, { status: 400 });
    }
    
    const data = await createUser(email, password, role as UserRole);
    
    return NextResponse.json({
      success: true,
      message: 'Usuario creado correctamente',
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 