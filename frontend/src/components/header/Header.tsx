'use client';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useCentralizedSession } from '@/hooks/use-centralized-session';
import { validateMaxProfiles } from '@/services/profile-validation.service';
import { ChevronDown, LogOut, Menu, Plus, Shield, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import SignIn, { handleSignOut } from '../authentication/sign-in';

const HeaderComponent = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isValidating, setIsValidating] = useState(false);
  const { session, status, isAdmin, userId } = useCentralizedSession();
  const router = useRouter();

  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;

      // Si estamos en la parte superior de la página, siempre mostrar el header
      if (currentScrollY < 10) {
        setIsVisible(true);
      }
      // Si scrolleamos hacia abajo, ocultar el header
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      // Si scrolleamos hacia arriba, mostrar el header
      else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  const handleCreateProfile = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Evitar que se cierre el menú inmediatamente si es necesario

    if (!userId) {
      toast.error('Debes iniciar sesión para crear un perfil');
      return;
    }

    setIsValidating(true);

    try {
      const validation = await validateMaxProfiles(userId);

      if (!validation.ok) {
        toast.error(validation.message || 'Has alcanzado el límite de perfiles');
        return;
      }

      // Validación pasó, redirigir al wizard
      router.push('/cuenta/crear-perfil');
      setMobileMenuOpen(false); // Cerrar menú móvil si está abierto

    } catch (error) {
      console.error('Error al validar perfiles:', error);
      toast.error('Error al validar. Intenta nuevamente.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <header className={`bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm border-b sticky top-0 z-50 transition-all duration-500 ease-in-out ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}>
      <div className="max-w-7xl mx-auto md:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4 lg:space-x-8">
            <div className="flex-shrink-0">
              <Link href="/">
                <Image
                  src="/images/logo 1.png" // tu archivo debe estar en /public/logo.png
                  alt="PrepagoYa"
                  width={300}     // ancho en píxeles
                  height={60}     // alto en píxeles
                />
              </Link>
            </div>
            {/* Desktop Search */}
            <div className="hidden lg:block">
              <div className="relative group">
                {/* <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-purple-600 transition-colors duration-200" />
                <Input
                  placeholder="Buscar..."
                  className="pl-10 w-80 bg-muted/50 border-border focus:bg-background focus:border-purple-500 transition-all duration-200 focus:shadow-lg focus:shadow-purple-500/10"
                /> */}
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-4">
            <Link href="/blog">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
              >
                Blog
              </Button>
            </Link>
            <Link href="/planes">
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
              >
                Planes
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                >
                  Nosotros
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/faq" className="flex items-center w-full cursor-pointer">
                    FAQ
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/terminos" className="flex items-center w-full cursor-pointer">
                    Términos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/contactanos" className="flex items-center w-full cursor-pointer">
                    Contactanos
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {(status === 'authenticated' || isAdmin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    Cuenta
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/adminboard" className="flex items-center">
                        <Shield className="h-4 w-4 mr-2" />
                        Panel de administrador
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {status === 'authenticated' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/cuenta" className="flex items-center">
                          <UserRound className="h-4 w-4 mr-2" />
                          Mi cuenta
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={handleCreateProfile}
                        disabled={isValidating}
                        className="flex items-center cursor-pointer text-purple-600 dark:text-purple-400 focus:text-purple-700 dark:focus:text-purple-300"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {isValidating ? 'Validando...' : 'Crear perfil'}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-500 focus:text-red-600">
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar sesión
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {status !== 'authenticated' && <SignIn />}
            <ThemeToggle />
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center space-x-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="hover:bg-muted/50 transition-colors duration-200"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="lg:hidden pb-4">
          <div className="relative group">
            {/* <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-purple-600 transition-colors duration-200" />
            <Input
              placeholder="Buscar..."
              className="pl-10 w-full bg-muted/50 border-border focus:bg-background focus:border-purple-500 transition-all duration-200"
            /> */}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-background/95 backdrop-blur py-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
            <Link href="/blog" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
              >
                Blog
              </Button>
            </Link>
            <Link href="/planes" onClick={() => setMobileMenuOpen(false)}>
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
              >
                Planes
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                >
                  Nosotros
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/faq" className="flex items-center w-full cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                    FAQ
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/terminos" className="flex items-center w-full cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                    Términos
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/contactanos" className="flex items-center w-full cursor-pointer" onClick={() => setMobileMenuOpen(false)}>
                    Contactanos
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {(status === 'authenticated' || isAdmin) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    Cuenta
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/adminboard" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Panel de administrador
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {status === 'authenticated' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/cuenta" className="flex items-center" onClick={() => setMobileMenuOpen(false)}>
                          <UserRound className="h-4 w-4 mr-2" />
                          Mi cuenta
                        </Link>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={handleCreateProfile}
                        disabled={isValidating}
                        className="flex items-center cursor-pointer text-purple-600 dark:text-purple-400 focus:text-purple-700 dark:focus:text-purple-300"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {isValidating ? 'Validando...' : 'Crear perfil'}
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => {
                          setMobileMenuOpen(false);
                          handleSignOut();
                        }}
                        className="cursor-pointer text-red-500 focus:text-red-600"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar sesión
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {status !== 'authenticated' && <SignIn />}

          </div>
        )}
      </div>
    </header>
  );
};

export default HeaderComponent;
