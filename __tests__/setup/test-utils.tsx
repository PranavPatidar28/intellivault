import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Add any providers you need here
interface AllTheProvidersProps {
    children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
    return <>{children}</>;
};

const customRender = (
    ui: ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>,
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Mock data generators
export const mockNote = (overrides = {}) => ({
    id: 'test-note-id',
    title: 'Test Note',
    contentJSON: { type: 'doc', content: [] },
    contentText: 'Test content',
    userId: 'test-user-id',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
});

export const mockTag = (overrides = {}) => ({
    id: 'test-tag-id',
    name: 'Test Tag',
    slug: 'test-tag',
    color: '#ef4444',
    description: 'Test tag description',
    parentId: null,
    isFavorite: false,
    isArchived: false,
    usageCount: 0,
    lastUsed: new Date('2024-01-01'),
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
});

export const mockUser = (overrides = {}) => ({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
});

export const mockSession = (overrides = {}) => ({
    user: mockUser(),
    session: {
        id: 'test-session-id',
        expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
        token: 'test-token',
        ...overrides,
    },
});

// Wait for async operations
export const waitFor = (callback: () => void, options = {}) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            callback();
            resolve(true);
        }, 0);
    });
};
