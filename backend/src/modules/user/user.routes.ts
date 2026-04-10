import { Router } from 'express';
import { adminMiddleware, authMiddleware } from '../../middlewares';
import * as userController from './user.controller';

const router = Router();

// Configurar contraseña después del registro con Google
router.post('/set-password-after-google-register', userController.setPasswordAfterGoogleRegisterController);

/* router.post('/create_user', userController.CreateUserController); */

/* router.get('/', profileController.obtenerPerfiles);
router.get('/:id', profileController.obtenerPerfilPorId);

router.delete('/:id', profileController.eliminarPerfil);*/

// Rutas de autenticación
router.post('/register', userController.registerUserController);
router.post('/login', userController.loginUserController);
router.post('/auth_google', userController.authGoogleUserController);
router.post('/verify_user', userController.verifyUserController);
router.post('/check-auth-method', userController.checkAuthMethodController);

// Rutas de recuperación de contraseña
router.post('/request-password-reset', userController.requestPasswordResetController);
router.post('/verify-reset-code', userController.verifyPasswordResetCodeController);
router.post('/reset-password', userController.resetPasswordController);

// Rutas de usuario
router.post('/upload_user_document', userController.uploadUserDocumentController);
router.get('/:id/profiles', userController.getUserProfiles);
router.post('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.put('/:id/last-login', userController.updateUserLastLogin);
router.delete('/:id', authMiddleware, adminMiddleware, userController.deleteUserController);



export default router;
