'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Camera, CheckCircle, Video, FileCheck, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HorizontalFilterBarFilters {
  identityVerified?: boolean;
  hasVideo?: boolean;
  documentVerified?: boolean;
  noDeposito?: boolean;
}

interface HorizontalFilterBarProps {
  filters?: HorizontalFilterBarFilters;
  onFiltersChange?: (filters: HorizontalFilterBarFilters) => void;
  onClearFilters?: () => void;
  className?: string;
}

const HorizontalFilterBar = ({
  filters = {},
  onFiltersChange,
  onClearFilters,
  className
}: HorizontalFilterBarProps) => {
  const [activeFilters, setActiveFilters] = useState<HorizontalFilterBarFilters>(filters);

  const handleFilterToggle = useCallback((filterKey: keyof HorizontalFilterBarFilters) => {
    const newFilters = {
      ...activeFilters,
      [filterKey]: !activeFilters[filterKey]
    };

    // Si el filtro se está desactivando, eliminarlo del objeto
    if (!newFilters[filterKey]) {
      delete newFilters[filterKey];
    }

    setActiveFilters(newFilters);
    onFiltersChange?.(newFilters);
  }, [activeFilters, onFiltersChange]);

  const getActiveFiltersCount = () => {
    return Object.values(activeFilters).filter(Boolean).length;
  };

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    onFiltersChange?.({});
    onClearFilters?.();
  }, [onFiltersChange, onClearFilters]);

  const filterButtons = [
    {
      key: 'identityVerified' as const,
      label: 'Fotos verificadas',
      icon: Camera,
      description: 'Perfiles con fotos de identidad verificadas',
      isActive: activeFilters.identityVerified,
    },
    {
      key: 'hasVideo' as const,
      label: 'Incluye video',
      icon: Video,
      description: 'Perfiles que incluyen contenido de video',
      isActive: activeFilters.hasVideo,
    },
    {
      key: 'documentVerified' as const,
      label: 'Documento verificado',
      icon: FileCheck,
      description: 'Perfiles con documentos verificados',
      isActive: activeFilters.documentVerified,
    },
    {
      key: 'noDeposito' as const,
      label: 'No pide anticipo',
      icon: Banknote,
      description: 'Perfiles que no piden anticipo',
      isActive: activeFilters.noDeposito,
    },
  ];

  return (
    <div className={cn(
      "backdrop-blur-sm transition-all duration-300",
      className
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-4 lg:px-6 py-2">
        <div className="flex flex-col space-y-4">
          {/* Header con contador de filtros activos */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {getActiveFiltersCount()} activo{getActiveFiltersCount() > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {getActiveFiltersCount() > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Botones de filtro */}
          <div className="flex flex-wrap gap-3">
            {filterButtons.map((filter, index) => {
              const Icon = filter.icon;
              return (
                <Button
                  key={filter.key}
                  variant={filter.isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterToggle(filter.key)}
                  className={cn(
                    "flex items-center space-x-2 transition-all duration-200 hover:scale-105",
                    "animate-in slide-in-from-bottom-2",
                    filter.isActive && [
                      "bg-gradient-to-r shadow-lg",
                      filter.key === 'identityVerified' && "from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800",
                      filter.key === 'hasVideo' && "from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800",
                      filter.key === 'documentVerified' && "from-green-600 to-green-700 hover:from-green-700 hover:to-green-800",
                      filter.key === 'noDeposito' && "from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800"
                    ],
                    !filter.isActive && [
                      "border-border/50 hover:border-border text-muted-foreground hover:text-foreground",
                      "hover:bg-muted/50"
                    ]
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                  title={filter.description}
                >
                  <Icon className={cn(
                    "w-4 h-4",
                    filter.isActive ? "text-white" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "text-sm font-medium",
                    filter.isActive ? "text-white" : "text-foreground"
                  )}>
                    {filter.label}
                  </span>
                  {filter.isActive && (
                    <CheckCircle className="w-3 h-3 text-white/80" />
                  )}
                </Button>
              );
            })}
          </div>

          {/* Indicador de filtros activos */}
          {getActiveFiltersCount() > 0 && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>Mostrando perfiles con:</span>
              <div className="flex flex-wrap gap-1">
                {activeFilters.identityVerified && (
                  <Badge variant="outline" className="text-xs">
                    Fotos verificadas
                  </Badge>
                )}
                {activeFilters.hasVideo && (
                  <Badge variant="outline" className="text-xs">
                    Video incluido
                  </Badge>
                )}
                {activeFilters.documentVerified && (
                  <Badge variant="outline" className="text-xs">
                    Documento verificado
                  </Badge>
                )}
                {activeFilters.noDeposito && (
                  <Badge variant="outline" className="text-xs">
                    No pide anticipo
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HorizontalFilterBar;