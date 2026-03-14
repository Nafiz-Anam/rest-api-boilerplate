export type CreatePostInput = {
  title: string;
  content: string;
  excerpt?: string;
  tags?: string[];
  published?: boolean;
};

export type UpdatePostInput = {
  title?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  published?: boolean;
};

export type SearchPostsInput = {
  query?: string;
  authorId?: string;
  tags?: string[];
  published?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
};

export type LikePostInput = {
  action?: 'like' | 'unlike';
};

export type AddCommentInput = {
  content: string;
};
