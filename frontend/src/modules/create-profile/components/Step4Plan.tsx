'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useFormContext } from '../context/FormContext';

import { useConfigValue } from '@/hooks/use-config-parameters';
import { useValidateCoupon } from '@/hooks/use-coupons';
import { usePlans } from '@/hooks/usePlans';
import { couponService } from '@/services/coupon.service';
import { AlertCircle, CheckCircle, Image, Loader, Music, Star, Ticket, Video, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface Plan {
  _id: string;
  name: string;
  code: string;
  level: number;
  variants: PlanVariant[];
  isActive: boolean;
  features?: {
    showInHome: boolean;
    showInFilters: boolean;
    showInSponsored: boolean;
  };
  contentLimits?: {
    photos: { min: number; max: number };
    videos: { min: number; max: number };
    audios: { min: number; max: number };
    storiesPerDayMax: number;
  };
  includedUpgrades?: string[];
}

interface PlanVariant {
  price: number;
  days: number;
  durationRank: number;
}

interface DefaultPlanConfig {
  enabled: boolean;
  planId: string | null;
  planCode: string | null;
}

export function Step4Plan() {
  const { watch, setValue, formState: { errors } } = useFormContext();
  const { data: session } = useSession();
  const formData = watch();
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);
  const [generateInvoice, setGenerateInvoice] = useState<boolean>(true); // Checkbox para administradores
  const [hasShownDefaultPlanToast, setHasShownDefaultPlanToast] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('defaultPlanToastShown') === 'true';
    }
    return false;
  });

  // Estados para el manejo de cupones
  const [showCouponInput, setShowCouponInput] = useState<boolean>(false);
  const [couponCode, setCouponCode] = useState<string>('');
  const [validatedCoupon, setValidatedCoupon] = useState<any>(null);

  // Hook para validar cupón
  const validateCouponMutation = useValidateCoupon();

  // Verificar si el usuario es administrador
  const isAdmin = session?.user?.role === 'admin';

  // Obtener planes disponibles
  const { data: plansResponse, isLoading: plansLoading } = usePlans({
    limit: 50,
    page: 1,
    isActive: true
  });
  const plans = plansResponse?.plans || [];

  // Obtener configuración del plan por defecto
  const { value: defaultConfig, loading: configLoading } = useConfigValue<DefaultPlanConfig>(
    'system.default_plan',
    {
      enabled: true,
      defaultValue: { enabled: false, planId: null, planCode: null }
    }
  );

  // Obtener el plan seleccionado
  const selectedPlan = plans.find(plan => plan._id === selectedPlanId);
  const selectedVariant = selectedPlan?.variants?.[selectedVariantIndex];



  // Inicializar estado local basado en valores del formulario al montar
  useEffect(() => {
    const currentSelectedPlan = formData.selectedPlan;
    const currentSelectedVariant = formData.selectedVariant;

    if (currentSelectedPlan && plans.length > 0) {
      // Si ya hay un plan seleccionado en el formulario, usar ese
      setSelectedPlanId(currentSelectedPlan._id);

      // Encontrar el índice de la variante seleccionada
      const plan = plans.find(p => p._id === currentSelectedPlan._id);
      if (plan && currentSelectedVariant) {
        const variantIndex = plan.variants.findIndex(v =>
          v.days === currentSelectedVariant.days && v.price === currentSelectedVariant.price
        );
        if (variantIndex !== -1) {
          setSelectedVariantIndex(variantIndex);
        }
      }
    }
  }, [formData.selectedPlan, formData.selectedVariant, plans]);

  // Cargar plan por defecto al montar el componente (solo si no hay plan seleccionado)
  useEffect(() => {
    if (defaultConfig?.enabled && defaultConfig.planId && plans.length > 0 &&
      !hasShownDefaultPlanToast && !formData.selectedPlan) {
      const defaultPlan = plans.find(plan => plan._id === defaultConfig.planId);
      if (defaultPlan) {
        setSelectedPlanId(defaultPlan._id);
        setSelectedVariantIndex(0);

        // Actualizar el formulario con el plan por defecto
        setValue('selectedPlan', {
          _id: defaultPlan._id,
          name: defaultPlan.name,
          code: defaultPlan.code,
          variants: defaultPlan.variants,
          contentLimits: {
            photos: { min: 0, max: defaultPlan.contentLimits?.photos?.max || 10 },
            videos: { min: 0, max: defaultPlan.contentLimits?.videos?.max || 5 },
            audios: { min: 0, max: defaultPlan.contentLimits?.audios?.max || 3 },
            storiesPerDayMax: defaultPlan.contentLimits?.storiesPerDayMax || 5
          }
        });

        setValue('selectedVariant', defaultPlan.variants[0]);

        toast.success(`Plan por defecto "${defaultPlan.name}" seleccionado automáticamente`);
        setHasShownDefaultPlanToast(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('defaultPlanToastShown', 'true');
        }
      }
    }
  }, [defaultConfig, plans, setValue, hasShownDefaultPlanToast, formData.selectedPlan]);

  // Validar límites de archivos cuando cambie el plan
  useEffect(() => {
    if (selectedPlan && selectedPlan.contentLimits) {
      const { photos, videos, audios } = selectedPlan.contentLimits;

      // Validar fotos
      if (formData.photos && formData.photos.length > photos.max) {
        toast.error(`El plan seleccionado permite máximo ${photos.max} fotos. Tienes ${formData.photos.length} fotos.`);
      }

      // Validar videos
      if (formData.videos && formData.videos.length > videos.max) {
        toast.error(`El plan seleccionado permite máximo ${videos.max} videos. Tienes ${formData.videos.length} videos.`);
      }

      // Validar audios
      if (formData.audios && formData.audios.length > audios.max) {
        toast.error(`El plan seleccionado permite máximo ${audios.max} audios. Tienes ${formData.audios.length} audios.`);
      }
    }
  }, [selectedPlan, formData.photos, formData.videos, formData.audios]);

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);

    const plan = plans.find(p => p._id === planId);
    if (plan) {
      // Obtener variantes filtradas si hay cupón activo
      const availableVariants = validatedCoupon ? getFilteredVariants(plan) : plan.variants;

      // Si hay variantes filtradas, seleccionar la primera permitida
      const firstVariantIndex = availableVariants.length > 0
        ? plan.variants.findIndex(v => v.days === availableVariants[0].days && v.price === availableVariants[0].price)
        : 0;

      setSelectedVariantIndex(firstVariantIndex);

      setValue('selectedPlan', {
        _id: plan._id,
        name: plan.name,
        code: plan.code,
        variants: plan.variants,
        contentLimits: {
          photos: { min: 0, max: plan.contentLimits?.photos?.max || 10 },
          videos: { min: 0, max: plan.contentLimits?.videos?.max || 5 },
          audios: { min: 0, max: plan.contentLimits?.audios?.max || 3 },
          storiesPerDayMax: plan.contentLimits?.storiesPerDayMax || 5
        }
      });

      setValue('selectedVariant', plan.variants[firstVariantIndex]);

      // Actualizar el estado de generar factura en el formulario para administradores
      if (isAdmin) {
        setValue('generateInvoice', generateInvoice);
      }
    }
  };

  const handleVariantChange = (variantIndex: number) => {
    setSelectedVariantIndex(variantIndex);
    if (selectedPlan) {
      const selectedVariant = selectedPlan.variants[variantIndex];

      // Validar que la variante esté permitida por el cupón
      if (validatedCoupon) {
        const filteredVariants = getFilteredVariants(selectedPlan);
        const isAllowed = filteredVariants.some(
          v => v.days === selectedVariant.days && v.price === selectedVariant.price
        );

        if (!isAllowed) {
          toast.error(`La variante de ${selectedVariant.days} días no está permitida por el cupón "${validatedCoupon.code}"`);
          return;
        }
      }

      setValue('selectedVariant', selectedVariant);

      // Actualizar el estado de generar factura en el formulario para administradores
      if (isAdmin) {
        setValue('generateInvoice', generateInvoice);
      }
    }
  };

  if (plansLoading || configLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="h-6 w-6 animate-spin" />
        <span className="ml-2">Cargando planes...</span>
      </div>
    );
  }

  // Función para validar cupón
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Ingresa un código de cupón válido');
      return;
    }

    try {
      // 🔄 LIMPIAR PLAN Y VARIANTE PREVIOS al canjear nuevo cupón
      // Esto previene errores de validación con el plan/variante anterior
      setSelectedPlanId('');
      setSelectedVariantIndex(0);
      setValue('selectedPlan', undefined);
      setValue('selectedVariant', undefined);

      // Usar directamente el servicio de cupones para validar en el frontend
      const result = await couponService.validateCouponForFrontend(couponCode);

      if (result.success && result.data) {
        const data = result.data;

        setValidatedCoupon(data);

        // Guardar el código del cupón en el formulario
        setValue('couponCode', couponCode);

        toast.success('Cupón válido aplicado');

        // Si el cupón es de tipo asignación de plan, seleccionar automáticamente ese plan
        if (data.type === 'plan_assignment' && data.planCode) {
          const assignedPlan = plans.find(p => p.code === data.planCode);
          if (assignedPlan) {
            setSelectedPlanId(assignedPlan._id);
            handlePlanChange(assignedPlan._id);
          }
        }
      } else {
        toast.error(result.message || 'Cupón inválido');
        setValidatedCoupon(null);
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al validar el cupón');
    }
  };

  // Función para limpiar el cupón
  const handleClearCoupon = () => {
    setCouponCode('');
    setValidatedCoupon(null);
    setValue('couponCode', ''); // Limpiar también del formulario
  };

  // Filtrar planes según el cupón validado
  const filteredPlans = validatedCoupon
    ? validatedCoupon.type === 'plan_assignment'
      ? plans.filter(plan => plan.code === validatedCoupon.planCode)
      : (() => {
        // Si tiene validPlanVariants (nueva estructura), extraer los códigos únicos
        if (validatedCoupon.validPlanVariants && validatedCoupon.validPlanVariants.length > 0) {
          const validPlanCodes = [...new Set(validatedCoupon.validPlanVariants.map(pv => pv.planCode))];
          return plans.filter(plan => validPlanCodes.includes(plan.code));
        }
        // Si tiene validPlanCodes (estructura antigua)
        else if (validatedCoupon.validPlanCodes && validatedCoupon.validPlanCodes.length > 0) {
          return plans.filter(plan => validatedCoupon.validPlanCodes!.includes(plan.code));
        }
        // Fallback a validPlanIds o applicablePlans
        else if (validatedCoupon.validPlanIds && validatedCoupon.validPlanIds.length > 0) {
          return plans.filter(plan => validatedCoupon.validPlanIds!.includes(plan._id));
        }
        else if (validatedCoupon.applicablePlans && validatedCoupon.applicablePlans.length > 0) {
          return plans.filter(plan => validatedCoupon.applicablePlans!.includes(plan._id));
        }
        return plans;
      })()
    : plans;

  // 🎯 Filtrar variantes del plan seleccionado según el cupón
  const getFilteredVariants = (plan: Plan): PlanVariant[] => {
    if (!validatedCoupon || validatedCoupon.type === 'plan_assignment') {
      return plan.variants;
    }

    // Si el cupón tiene validPlanVariants, filtrar solo las variantes permitidas
    if (validatedCoupon.validPlanVariants && validatedCoupon.validPlanVariants.length > 0) {
      const allowedVariantDays = validatedCoupon.validPlanVariants
        .filter(pv => pv.planCode === plan.code)
        .map(pv => pv.variantDays);

      return plan.variants.filter(variant => allowedVariantDays.includes(variant.days));
    }

    // Si tiene validVariantDays (estructura antigua), filtrar por días
    if (validatedCoupon.validVariantDays && validatedCoupon.validVariantDays.length > 0) {
      return plan.variants.filter(variant =>
        validatedCoupon.validVariantDays!.includes(variant.days)
      );
    }

    // Sin restricciones de variante, devolver todas
    return plan.variants;
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 slide-in-from-right-4 duration-500">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-r from-red-600 to-pink-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
          04
        </div>
        <h2 className="text-2xl font-bold text-foreground">Plan</h2>
      </div>

      <div className="space-y-6">
        {/* Sección de Cupón */}
        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200/50 dark:border-purple-800/50">
          <div className="flex items-center space-x-2 mb-3">
            <Ticket className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              ¿Tienes un cupón?
            </h3>
          </div>

          {!showCouponInput && !validatedCoupon ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => setShowCouponInput(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 text-sm font-medium w-full sm:w-auto"
              >
                Tengo un cupón
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCouponInput(false)}
                className="text-sm font-medium w-full sm:w-auto"
              >
                No tengo un cupón
              </Button>
            </div>
          ) : validatedCoupon ? (
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    Cupón aplicado: {validatedCoupon.code}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    {validatedCoupon.type === 'percentage' && `${validatedCoupon.value}% de descuento`}
                    {validatedCoupon.type === 'fixed_amount' && `$${validatedCoupon.value.toLocaleString()} de descuento`}
                    {validatedCoupon.type === 'plan_assignment' && `Asigna plan ${validatedCoupon.planCode}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCoupon}
                  className="h-8 w-8 p-0 self-end sm:self-center hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                  title="Eliminar cupón"
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                placeholder="Ingresa tu código"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 text-sm bg-white dark:bg-gray-800 w-full"
                maxLength={50}
              />
              <Button
                onClick={handleValidateCoupon}
                disabled={!couponCode.trim() || validateCouponMutation.isPending}
                className="bg-gradient-to-r from-red-600 to-pink-500 hover:from-red-700 hover:to-pink-600 text-white px-4 py-2 text-sm font-medium w-full sm:w-auto"
              >
                {validateCouponMutation.isPending ? 'Validando...' : 'Canjear cupón'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCouponInput(false);
                  setCouponCode('');
                }}
                className="text-sm font-medium w-full sm:w-auto"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>


        {/* Selección de Plan */}
        <div>
          <Label className="text-foreground text-lg font-semibold mb-4 block">
            Plan de Membresía <span className="text-red-500">*</span>
          </Label>
          <Select
            key={`plan-${selectedPlanId}`}
            value={selectedPlanId}
            onValueChange={handlePlanChange}
            disabled={validatedCoupon?.type === 'plan_assignment'}
          >
            <SelectTrigger className={`w-full ${errors.selectedPlan ? 'border-red-500' : ''}`}>
              <SelectValue
                placeholder="Selecciona un plan"
                className={selectedPlanId ? 'text-foreground' : 'text-muted-foreground'}
              />
            </SelectTrigger>
            <SelectContent>
              {filteredPlans.map((plan) => {
                // Calcular el precio mínimo entre todas las variantes
                const minPrice = plan.variants.length > 0
                  ? Math.min(...plan.variants.map(v => v.price))
                  : 0;

                return (
                  <SelectItem key={plan._id} value={plan._id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{plan.name}</span>
                      {plan.variants.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          Desde ${minPrice.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {errors.selectedPlan && (
            <p className="text-red-500 text-sm mt-1">
              {errors.selectedPlan.message}
            </p>
          )}
          {validatedCoupon?.type === 'plan_assignment' && (
            <p className="text-green-600 text-sm mt-1">
              El plan ha sido seleccionado automáticamente según el cupón aplicado
            </p>
          )}
        </div>

        {/* Selector de Variante */}
        {selectedPlan && selectedPlan.variants.length > 1 && (
          <div>
            <Label className="text-foreground text-lg font-semibold mb-4 block">
              Duración del Plan
            </Label>
            {validatedCoupon && (
              <p className="text-sm text-muted-foreground mb-2">
                {validatedCoupon.validPlanVariants?.length
                  ? `Mostrando solo las variantes permitidas por el cupón "${validatedCoupon.code}"`
                  : 'Selecciona la duración de tu plan'}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredVariants(selectedPlan).map((variant, index) => {
                // Encontrar el índice real en el array original de variantes
                const actualIndex = selectedPlan.variants.findIndex(
                  v => v.days === variant.days && v.price === variant.price
                );

                return (
                  <Card
                    key={index}
                    className={`cursor-pointer transition-all duration-200 ${selectedVariantIndex === actualIndex
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                      : 'hover:border-purple-300'
                      }`}
                    onClick={() => handleVariantChange(actualIndex)}
                  >
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">
                          ${variant.price.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {variant.days} días
                        </div>
                        {selectedVariantIndex === actualIndex && (
                          <CheckCircle className="h-5 w-5 text-purple-500 mx-auto mt-2" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Detalles del Plan Seleccionado */}
        {selectedPlan && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center">
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                Plan Seleccionado: {selectedPlan.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Información del Plan */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedVariant && (
                    <>
                      <div>
                        <span className="text-muted-foreground">Precio</span>
                        <p className="text-foreground font-medium">
                          ${selectedVariant.price.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duración</span>
                        <p className="text-foreground font-medium">
                          {selectedVariant.days} días
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {/* Jerarquía del Plan */}
                {/* <Separator />

                
                <div>
                  <h4 className="font-semibold text-foreground mb-3 flex items-center">
                    {selectedPlan.level === 1 && <Crown className="h-5 w-5 text-purple-500 mr-2" />}
                    {selectedPlan.level === 2 && <Gem className="h-5 w-5 text-blue-500 mr-2" />}
                    {selectedPlan.level === 3 && <Shield className="h-5 w-5 text-green-500 mr-2" />}
                    {selectedPlan.level === 4 && <Star className="h-5 w-5 text-orange-500 mr-2" />}
                    {selectedPlan.level === 5 && <Zap className="h-5 w-5 text-yellow-500 mr-2" />}
                    {selectedPlan.name}
                  </h4>
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedPlan.level === 1 && "👑 AMATISTA - Máxima visibilidad y todas las características premium"}
                      {selectedPlan.level === 2 && "💎 ZAFIRO - Excelente visibilidad con características avanzadas"}
                      {selectedPlan.level === 3 && "💚 ESMERALDA - Buena visibilidad con características estándar"}
                      {selectedPlan.level === 4 && "🥇 ORO - Visibilidad estándar con características básicas"}
                      {selectedPlan.level === 5 && "💎 DIAMANTE - Plan básico para comenzar"}
                    </p>

                  </div>
                </div> */}

                <Separator />

                {/* Beneficios de Visibilidad */}
                {selectedPlan.features && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Beneficios de Visibilidad</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`p-3 rounded-lg border-2 ${selectedPlan.features.showInHome
                        ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                        : 'border-gray-200 bg-gray-50 dark:bg-gray-950/20'
                        }`}>
                        <div className="flex items-center space-x-2">
                          {selectedPlan.features.showInHome ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={`text-sm font-medium ${selectedPlan.features.showInHome ? 'text-green-700 dark:text-green-300' : 'text-gray-500'
                            }`}>
                            Mostrar en Home
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedPlan.features.showInHome
                            ? 'Tu perfil aparecerá en la página principal'
                            : 'No aparecerás en la página principal'}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border-2 ${selectedPlan.features.showInFilters
                        ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                        : 'border-gray-200 bg-gray-50 dark:bg-gray-950/20'
                        }`}>
                        <div className="flex items-center space-x-2">
                          {selectedPlan.features.showInFilters ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={`text-sm font-medium ${selectedPlan.features.showInFilters ? 'text-green-700 dark:text-green-300' : 'text-gray-500'
                            }`}>
                            Mostrar en Filtros
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedPlan.features.showInFilters
                            ? 'Aparecerás en resultados de búsqueda'
                            : 'No aparecerás en búsquedas filtradas'}
                        </p>
                      </div>
                      <div className={`p-3 rounded-lg border-2 ${selectedPlan.features.showInSponsored
                        ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                        : 'border-gray-200 bg-gray-50 dark:bg-gray-950/20'
                        }`}>
                        <div className="flex items-center space-x-2">
                          {selectedPlan.features.showInSponsored ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span className={`text-sm font-medium ${selectedPlan.features.showInSponsored ? 'text-green-700 dark:text-green-300' : 'text-gray-500'
                            }`}>
                            Contenido Patrocinado
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedPlan.features.showInSponsored
                            ? 'Acceso a posiciones destacadas'
                            : 'Sin acceso a posiciones patrocinadas'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Límites de Contenido */}
                {selectedPlan.contentLimits && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Límites de Contenido</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex items-center space-x-2">
                        <Image className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">{selectedPlan.contentLimits.photos.max}</p>
                          <p className="text-xs text-muted-foreground">Fotos máx.</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Video className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-sm font-medium">{selectedPlan.contentLimits.videos.max}</p>
                          <p className="text-xs text-muted-foreground">Videos máx.</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Music className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{selectedPlan.contentLimits.audios.max}</p>
                          <p className="text-xs text-muted-foreground">Audios máx.</p>
                        </div>
                      </div>

                      {selectedPlan.contentLimits.storiesPerDayMax && (
                        <div className="flex items-center space-x-2">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <div>
                            <p className="text-sm font-medium">{selectedPlan.contentLimits.storiesPerDayMax}</p>
                            <p className="text-xs text-muted-foreground">Stories/día</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Upgrades Incluidos */}
                {selectedPlan.includedUpgrades && selectedPlan.includedUpgrades.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Upgrades Incluidos</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedPlan.includedUpgrades.map((upgrade, index) => (
                        <Badge key={index} variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          <Zap className="h-3 w-3 mr-1" />
                          {upgrade}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Estos upgrades están incluidos automáticamente en tu plan
                    </p>
                  </div>
                )}

                {/* Validación de Archivos Actuales */}
                {selectedPlan.contentLimits && (
                  <div>
                    <h4 className="font-semibold text-foreground mb-3">Estado Actual de tus Archivos</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Fotos subidas:</span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${(formData.photos?.length || 0) <= selectedPlan.contentLimits.photos.max
                            ? 'text-green-600'
                            : 'text-red-600'
                            }`}>
                            {formData.photos?.length || 0} / {selectedPlan.contentLimits.photos.max}
                          </span>
                          {(formData.photos?.length || 0) <= selectedPlan.contentLimits.photos.max ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Videos subidos:</span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${(formData.videos?.length || 0) <= selectedPlan.contentLimits.videos.max
                            ? 'text-green-600'
                            : 'text-red-600'
                            }`}>
                            {formData.videos?.length || 0} / {selectedPlan.contentLimits.videos.max}
                          </span>
                          {(formData.videos?.length || 0) <= selectedPlan.contentLimits.videos.max ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Audios subidos:</span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${(formData.audios?.length || 0) <= selectedPlan.contentLimits.audios.max
                            ? 'text-green-600'
                            : 'text-red-600'
                            }`}>
                            {formData.audios?.length || 0} / {selectedPlan.contentLimits.audios.max}
                          </span>
                          {(formData.audios?.length || 0) <= selectedPlan.contentLimits.audios.max ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checkbox para generar factura (solo para administradores) */}
        {isAdmin && selectedPlan && selectedVariant && selectedVariant.price > 0 && (
          <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="generateInvoice"
                  checked={generateInvoice}
                  onCheckedChange={(checked) => {
                    setGenerateInvoice(checked as boolean);
                    setValue('generateInvoice', checked as boolean);
                  }}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="generateInvoice"
                    className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer"
                  >
                    Generar factura para este plan
                  </Label>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    {generateInvoice
                      ? 'Se generará una factura y el perfil estará inactivo hasta el pago'
                      : 'Se asignará el plan directamente sin generar factura (solo administradores)'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
