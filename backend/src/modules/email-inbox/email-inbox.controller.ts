import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from '../../types/auth.types';
import {
  InboxEmailQuery,
  IncomingEmailData,
  MarkAsReadRequest
} from '../../types/email-inbox.types';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { EmailInboxService } from './email-inbox.service';

export class EmailInboxController {
  /**
   * Obtener lista de correos recibidos
   * GET /api/email-inbox
   */
  static async getInboxEmails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const query: InboxEmailQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        from: req.query.from as string,
        subject: req.query.subject as string,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        isRead: req.query.isRead ? req.query.isRead === 'true' : undefined
      };

      const result = await EmailInboxService.getInboxEmails(query);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error in getInboxEmails controller:', error);
      next(error);
    }
  }

  /**
   * Obtener un correo específico por ID
   * GET /api/email-inbox/:id
   */
  static async getEmailById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      const email = await EmailInboxService.getEmailById(id);

      if (!email) {
        throw new AppError('Email not found', 404);
      }

      res.status(200).json({
        success: true,
        data: email
      });
    } catch (error) {
      logger.error('Error in getEmailById controller:', error);
      next(error);
    }
  }

  /**
   * Marcar correos como leídos
   * PATCH /api/email-inbox/mark-read
   */
  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const request: MarkAsReadRequest = req.body;

      if (!request.emailIds || !Array.isArray(request.emailIds) || request.emailIds.length === 0) {
        throw new AppError('emailIds array is required and must not be empty', 400);
      }

      const result = await EmailInboxService.markAsRead(request);

      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} emails marked as read`,
        data: result
      });
    } catch (error) {
      logger.error('Error in markAsRead controller:', error);
      next(error);
    }
  }

  /**
   * Marcar correos como no leídos
   * PATCH /api/email-inbox/mark-unread
   */
  static async markAsUnread(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const request: MarkAsReadRequest = req.body;

      if (!request.emailIds || !Array.isArray(request.emailIds) || request.emailIds.length === 0) {
        throw new AppError('emailIds array is required and must not be empty', 400);
      }

      const result = await EmailInboxService.markAsUnread(request);

      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} emails marked as unread`,
        data: result
      });
    } catch (error) {
      logger.error('Error in markAsUnread controller:', error);
      next(error);
    }
  }

  /**
   * Eliminar correos
   * DELETE /api/email-inbox
   */
  static async deleteEmails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { emailIds } = req.body;

      if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
        throw new AppError('emailIds array is required and must not be empty', 400);
      }

      const result = await EmailInboxService.deleteEmails(emailIds);

      res.status(200).json({
        success: true,
        message: `${result.deletedCount} emails deleted`,
        data: result
      });
    } catch (error) {
      logger.error('Error in deleteEmails controller:', error);
      next(error);
    }
  }

  /**
   * Obtener estadísticas del inbox
   * GET /api/email-inbox/stats
   */
  static async getInboxStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await EmailInboxService.getInboxStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error in getInboxStats controller:', error);
      next(error);
    }
  }

  /**
   * Webhook para recibir correos (desde Mailjet u otro proveedor)
   * POST /api/email-inbox/webhook
   */
  static async receiveEmailWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const webhookData = req.body;

      // Validar que sea un evento de correo recibido
      if (!webhookData || !webhookData.email) {
        throw new AppError('Invalid webhook payload', 400);
      }

      const emailData: IncomingEmailData = {
        from: {
          email: webhookData.email.from?.email || webhookData.from,
          name: webhookData.email.from?.name
        },
        to: {
          email: webhookData.email.to?.email || webhookData.to,
          name: webhookData.email.to?.name
        },
        subject: webhookData.email.subject || webhookData.subject || '',
        textPart: webhookData.email.textPart || webhookData.text,
        htmlPart: webhookData.email.htmlPart || webhookData.html,
        messageId: webhookData.email.messageId || webhookData.messageId || `${Date.now()}-${Math.random()}`,
        receivedAt: webhookData.email.receivedAt ? new Date(webhookData.email.receivedAt) : new Date(),
        attachments: webhookData.email.attachments,
        headers: webhookData.email.headers
      };

      const savedEmail = await EmailInboxService.storeIncomingEmail(emailData);

      logger.info(`Received email via webhook: ${savedEmail._id}`);

      res.status(200).json({
        success: true,
        message: 'Email received and stored successfully',
        data: {
          id: savedEmail._id,
          messageId: savedEmail.messageId
        }
      });
    } catch (error) {
      logger.error('Error in receiveEmailWebhook controller:', error);
      next(error);
    }
  }

  /**
   * Endpoint de prueba para simular recepción de correo
   * POST /api/email-inbox/test-receive
   */
  static async testReceiveEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const testEmailData: IncomingEmailData = {
        from: {
          email: req.body.from || 'test@example.com',
          name: req.body.fromName || 'Test Sender'
        },
        to: {
          email: req.body.to || 'company@example.com',
          name: req.body.toName || 'Company'
        },
        subject: req.body.subject || 'Test Email',
        textPart: req.body.textPart || 'This is a test email.',
        htmlPart: req.body.htmlPart || '<p>This is a test email.</p>',
        messageId: `test-${Date.now()}-${Math.random()}`,
        receivedAt: new Date(),
        headers: req.body.headers || {}
      };

      const savedEmail = await EmailInboxService.storeIncomingEmail(testEmailData);

      res.status(201).json({
        success: true,
        message: 'Test email created successfully',
        data: {
          id: savedEmail._id,
          messageId: savedEmail.messageId
        }
      });
    } catch (error) {
      logger.error('Error in testReceiveEmail controller:', error);
      next(error);
    }
  }
}