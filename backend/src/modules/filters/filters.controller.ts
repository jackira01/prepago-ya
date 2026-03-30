import { Request, Response } from 'express';
import * as service from './filters.service';
import type { FilterQuery } from './filters.types';

// Controlador GET eliminado - solo se usa POST para filtros de perfiles

/**
 * POST /api/filters/profiles
 * Obtiene perfiles filtrados usando body (más escalable)
 */
export const getFilteredProfilesPost = async (req: Request, res: Response) => {
  try {
    // Procesar el body de la misma manera que GET procesa query params
    const {
      category,
      location,
      features,
      priceRange,
      availability,
      isActive,
      isVerified,
      profileVerified,
      documentVerified,
      noDeposito,
      hasDestacadoUpgrade,
      hasVideos,
      page,
      limit,
      sortBy,
      sortOrder,
      fields
    } = req.body;

    // Construir objeto de filtros procesado
    const filters: FilterQuery = {};

    // Filtros básicos
    if (category) filters.category = category;
    if (isActive !== undefined) filters.isActive = isActive;
    if (isVerified !== undefined) filters.isVerified = isVerified;
    if (profileVerified !== undefined) filters.profileVerified = profileVerified;
    if (documentVerified !== undefined) filters.documentVerified = documentVerified;
    if (noDeposito !== undefined) filters.noDeposito = noDeposito;
    if (hasDestacadoUpgrade !== undefined) filters.hasDestacadoUpgrade = hasDestacadoUpgrade;
    if (hasVideos !== undefined) filters.hasVideos = hasVideos;

    // Filtros de ubicación - procesar igual que GET
    if (location) {
      filters.location = {};
      if (location.country) filters.location.country = location.country;
      if (location.department) filters.location.department = location.department;
      if (location.city) filters.location.city = location.city;
    }

    // Filtros de características - ya vienen como objeto
    if (features) {
      filters.features = features;
    }

    // Filtros de precio - procesar igual que GET
    if (priceRange) {
      filters.priceRange = {};
      if (priceRange.min !== undefined) {
        if (isNaN(priceRange.min)) {
          return res.status(400).json({
            success: false,
            message: 'priceRange.min debe ser un número válido'
          });
        }
        filters.priceRange.min = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        if (isNaN(priceRange.max)) {
          return res.status(400).json({
            success: false,
            message: 'priceRange.max debe ser un número válido'
          });
        }
        filters.priceRange.max = priceRange.max;
      }
    }

    // Filtros de disponibilidad
    if (availability) {
      filters.availability = availability;
    }

    // Paginación y ordenamiento
    if (page !== undefined) filters.page = page;
    if (limit !== undefined) filters.limit = limit;
    if (sortBy) filters.sortBy = sortBy;
    if (sortOrder) filters.sortOrder = sortOrder;
    if (fields) filters.fields = fields;



    // Validaciones adicionales
    if (filters.page && (isNaN(filters.page) || filters.page < 1)) {
      return res.status(400).json({
        success: false,
        message: 'page debe ser un número entero mayor a 0'
      });
    }

    if (filters.limit && (isNaN(filters.limit) || filters.limit < 1 || filters.limit > 100)) {
      return res.status(400).json({
        success: false,
        message: 'limit debe ser un número entre 1 y 100'
      });
    }

    if (filters.sortBy) {
      const validSortFields = ['createdAt', 'updatedAt', 'name', 'price'];
      if (!validSortFields.includes(filters.sortBy)) {
        return res.status(400).json({
          success: false,
          message: `sortBy debe ser uno de: ${validSortFields.join(', ')}`
        });
      }
    }

    if (filters.sortOrder && filters.sortOrder !== 'asc' && filters.sortOrder !== 'desc') {
      return res.status(400).json({
        success: false,
        message: 'sortOrder debe ser "asc" o "desc"'
      });
    }

    // Obtener perfiles filtrados
    const result = await service.getFilteredProfiles(filters);

    const response = {
      success: true,
      data: result,
      message: 'Perfiles obtenidos exitosamente'
    };

    res.status(200).json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    // Error in getFilteredProfilesPost controller
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? {
        message: errorMessage,
        stack: errorStack,
        name: errorName
      } : undefined
    });
  }
};

/**
 * GET /api/filters/options
 * Obtiene las opciones disponibles para los filtros
 */
export const getFilterOptions = async (req: Request, res: Response) => {
  try {
    const options = await service.getFilterOptions();

    res.status(200).json({
      success: true,
      data: options,
      message: 'Opciones de filtros obtenidas exitosamente'
    });
  } catch (error: unknown) {
    // Error in getFilterOptions controller
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};