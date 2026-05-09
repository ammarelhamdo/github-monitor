import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: 'ADMIN' | 'EMPLOYEE'
    }
  }
  interface User {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'EMPLOYEE'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'EMPLOYEE'
  }
}
