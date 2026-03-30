import { Types } from 'mongoose';
import {
  InboxEmailListResponse,
  InboxEmailQuery,
  InboxEmailResponse,
  IncomingEmailData,
  MarkAsReadRequest
} from '../../types/email-inbox.types';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { type IEmailInbox, EmailInboxModel } from './email-inbox.model';

export class EmailInboxService {
  /**
   * Almacenar un correo recibido
   */
  static async storeIncomingEmail(emailData: IncomingEmailData): Promise<IEmailInbox> {
    try {
      // Verificar si el correo ya existe por messageId
      const existingEmail = await EmailInboxModel.findOne({
        messageId: emailData.messageId
      });

      if (existingEmail) {
        logger.warn(`Email with messageId ${emailData.messageId} already exists`);
        return existingEmail;
      }

      const email = new EmailInboxModel({
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        textPart: emailData.textPart,
        htmlPart: emailData.htmlPart,
        attachments: emailData.attachments,
        messageId: emailData.messageId,
        receivedAt: emailData.receivedAt,
        headers: emailData.headers,
        isRead: false
      });

      const savedEmail = await email.save();
      logger.info(`Stored incoming email with ID: ${savedEmail._id}`);

      return savedEmail;
    } catch (error: any) {
      logger.error('Error storing incoming email:', error);
      throw new AppError('Failed to store incoming email', 500);
    }
  }

  /**
   * Obtener lista de correos recibidos con paginación y filtros
   */
  static async getInboxEmails(query: InboxEmailQuery): Promise<InboxEmailListResponse> {
    try {
      const {
        page = 1,
        limit = 20,
        from,
        subject,
        dateFrom,
        dateTo,
        isRead
      } = query;

      // Construir filtros
      const filters: any = {};

      if (from) {
        filters['from.email'] = { $regex: from, $options: 'i' };
      }

      if (subject) {
        filters.subject = { $regex: subject, $options: 'i' };
      }

      if (dateFrom || dateTo) {
        filters.receivedAt = {};
        if (dateFrom) filters.receivedAt.$gte = new Date(dateFrom);
        if (dateTo) filters.receivedAt.$lte = new Date(dateTo);
      }

      if (typeof isRead === 'boolean') {
        filters.isRead = isRead;
      }

      // Calcular skip
      const skip = (page - 1) * limit;

      // Ejecutar consultas en paralelo
      const [emails, total] = await Promise.all([
        EmailInboxModel
          .find(filters)
          .sort({ receivedAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-headers -attachments.content')
          .lean(),
        EmailInboxModel.countDocuments(filters)
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        emails: emails.map(email => ({
          id: email._id.toString(),
          from: email.from,
          to: email.to,
          subject: email.subject,
          textPart: email.textPart,
          htmlPart: email.htmlPart,
          attachments: email.attachments?.map(att => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            contentId: att.contentId
          })),
          messageId: email.messageId,
          receivedAt: email.receivedAt,
          isRead: email.isRead,
          createdAt: email.createdAt,
          updatedAt: email.updatedAt
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };
    } catch (error: any) {
      logger.error('Error getting inbox emails:', error);
      throw new AppError('Failed to get inbox emails', 500);
    }
  }

  /**
   * Obtener un correo específico por ID
   */
  static async getEmailById(emailId: string): Promise<InboxEmailResponse | null> {
    try {
      if (!Types.ObjectId.isValid(emailId)) {
        throw new AppError('Invalid email ID', 400);
      }

      const email = await EmailInboxModel
        .findById(emailId)
        .select('-headers')
        .lean();

      if (!email) {
        return null;
      }

      return {
        id: email._id.toString(),
        from: email.from,
        to: email.to,
        subject: email.subject,
        textPart: email.textPart,
        htmlPart: email.htmlPart,
        attachments: email.attachments,
        messageId: email.messageId,
        receivedAt: email.receivedAt,
        isRead: email.isRead,
        createdAt: email.createdAt,
        updatedAt: email.updatedAt
      };
    } catch (error: any) {
      logger.error(`Error getting email by ID ${emailId}:`, error);
      throw new AppError('Failed to get email', 500);
    }
  }

  /**
   * Marcar correos como leídos
   */
  static async markAsRead(request: MarkAsReadRequest): Promise<{ modifiedCount: number }> {
    try {
      const { emailIds } = request;

      // Validar IDs
      const validIds = emailIds.filter(id => Types.ObjectId.isValid(id));

      if (validIds.length === 0) {
        throw new AppError('No valid email IDs provided', 400);
      }

      const result = await EmailInboxModel.updateMany(
        {
          _id: { $in: validIds.map(id => new Types.ObjectId(id)) },
          isRead: false
        },
        {
          $set: { isRead: true }
        }
      );

      logger.info(`Marked ${result.modifiedCount} emails as read`);

      return { modifiedCount: result.modifiedCount };
    } catch (error: any) {
      logger.error('Error marking emails as read:', error);
      throw new AppError('Failed to mark emails as read', 500);
    }
  }

  /**
   * Marcar correos como no leídos
   */
  static async markAsUnread(request: MarkAsReadRequest): Promise<{ modifiedCount: number }> {
    try {
      const { emailIds } = request;

      // Validar IDs
      const validIds = emailIds.filter(id => Types.ObjectId.isValid(id));

      if (validIds.length === 0) {
        throw new AppError('No valid email IDs provided', 400);
      }

      const result = await EmailInboxModel.updateMany(
        {
          _id: { $in: validIds.map(id => new Types.ObjectId(id)) },
          isRead: true
        },
        {
          $set: { isRead: false }
        }
      );

      logger.info(`Marked ${result.modifiedCount} emails as unread`);

      return { modifiedCount: result.modifiedCount };
    } catch (error: any) {
      logger.error('Error marking emails as unread:', error);
      throw new AppError('Failed to mark emails as unread', 500);
    }
  }

  /**
   * Eliminar correos
   */
  static async deleteEmails(emailIds: string[]): Promise<{ deletedCount: number }> {
    try {
      // Validar IDs
      const validIds = emailIds.filter(id => Types.ObjectId.isValid(id));

      if (validIds.length === 0) {
        throw new AppError('No valid email IDs provided', 400);
      }

      const result = await EmailInboxModel.deleteMany({
        _id: { $in: validIds.map(id => new Types.ObjectId(id)) }
      });

      logger.info(`Deleted ${result.deletedCount} emails`);

      return { deletedCount: result.deletedCount };
    } catch (error: any) {
      logger.error('Error deleting emails:', error);
      throw new AppError('Failed to delete emails', 500);
    }
  }

  /**
   * Obtener estadísticas del inbox
   */
  static async getInboxStats(): Promise<{
    total: number;
    unread: number;
    read: number;
    todayCount: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [total, unread, todayCount] = await Promise.all([
        EmailInboxModel.countDocuments({}),
        EmailInboxModel.countDocuments({ isRead: false }),
        EmailInboxModel.countDocuments({
          receivedAt: {
            $gte: today,
            $lt: tomorrow
          }
        })
      ]);

      return {
        total,
        unread,
        read: total - unread,
        todayCount
      };
    } catch (error: any) {
      logger.error('Error getting inbox stats:', error);
      throw new AppError('Failed to get inbox stats', 500);
    }
  }
}