import { describe, it, expect, vi } from 'vitest';
import { handleFirestoreError, OperationType } from './firestoreErrorHandler';
import { auth } from '../firebase';

// Mock auth
vi.mock('../firebase', () => ({
  auth: {
    currentUser: {
      uid: 'test-uid',
      email: 'test@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: null,
      providerData: [
        {
          providerId: 'google.com',
          displayName: 'Test User',
          email: 'test@example.com',
          photoURL: 'https://example.com/photo.jpg',
        },
      ],
    },
  },
}));

describe('handleFirestoreError', () => {
  it('should throw an error with JSON string containing error info', () => {
    const error = new Error('Missing or insufficient permissions.');
    const operationType = OperationType.GET;
    const path = 'users/test-uid';

    expect(() => handleFirestoreError(error, operationType, path)).toThrow();

    try {
      handleFirestoreError(error, operationType, path);
    } catch (thrownError: any) {
      const errorInfo = JSON.parse(thrownError.message);
      expect(errorInfo.error).toBe('Missing or insufficient permissions.');
      expect(errorInfo.operationType).toBe(OperationType.GET);
      expect(errorInfo.path).toBe(path);
      expect(errorInfo.authInfo.userId).toBe('test-uid');
      expect(errorInfo.authInfo.email).toBe('test@example.com');
    }
  });

  it('should handle non-Error objects', () => {
    const error = 'String error';
    const operationType = OperationType.WRITE;
    const path = 'schedules';

    try {
      handleFirestoreError(error, operationType, path);
    } catch (thrownError: any) {
      const errorInfo = JSON.parse(thrownError.message);
      expect(errorInfo.error).toBe('String error');
      expect(errorInfo.operationType).toBe(OperationType.WRITE);
    }
  });
});
