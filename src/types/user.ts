export type UpdateProfileInput = {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export type SearchUsersInput = {
  query?: string;
  role?: 'USER' | 'MODERATOR' | 'ADMIN';
  isActive?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  lastLoginAfter?: string;
  page?: number;
  limit?: number;
  sortBy?: 'username' | 'email' | 'createdAt' | 'updatedAt' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
};
