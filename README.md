# IntelliVault

**IntelliVault** is a modern, feature-rich note-taking application built with Next.js, featuring a powerful rich text editor, advanced tag management, and seamless user experience. Create, organize, and manage your notes with hierarchical tags, favorites, analytics, and more.

![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19.2-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue?style=flat-square&logo=postgresql)

## ✨ Features

### 📝 Note Management
- **Rich Text Editor**: Powered by Tiptap with extensive formatting options
  - Headings, lists, code blocks, tables
  - Text alignment, highlighting, subscript/superscript
  - Image support, horizontal rules
  - Typography enhancements
- **Auto-save**: Automatic saving with debounce
- **Real-time Updates**: Instant synchronization across components
- **Delete Confirmation**: Prevent accidental deletions

### 🏷️ Advanced Tag System
- **User-Specific Tags**: Each user has their own isolated tag system
- **Hierarchical Tags**: Create parent-child relationships
- **Tag Relations**: Link related tags together with strength ratings
- **Tag Views**: Create saved views with custom filters
- **Favorites & Archive**: Mark important tags and archive unused ones
- **Bulk Operations**: Manage multiple tags at once
- **Tag Analytics**: Visualize tag usage and relationships
- **Export/Import**: Backup and restore your tag system
- **Tag Suggestions**: Smart tag recommendations
- **Tag Merging**: Combine duplicate or related tags
- **Color Coding**: Organize tags with custom colors

### 🔐 Authentication & Security
- **Better Auth Integration**: Robust authentication system
- **Google OAuth**: Sign in with Google
- **Email/Password**: Traditional authentication option
- **Session Management**: Secure session handling with cookie caching
- **User Isolation**: Complete data separation between users

### 🎨 User Interface
- **Dark Mode**: Built-in theme switching with next-themes
- **Responsive Design**: Works seamlessly on all devices
- **Keyboard Shortcuts**: Efficient keyboard navigation
- **Smooth Animations**: Polished UI interactions
- **Loading States**: Skeleton loaders for better UX

### 🧪 Testing
- **Unit Tests**: Comprehensive test coverage
  - Utility functions
  - Custom hooks
  - API routes
  - Validation schemas
- **Jest & React Testing Library**: Modern testing stack

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS 4](https://tailwindcss.com/)
- **Components**: [Radix UI](https://www.radix-ui.com/)
- **Rich Text**: [Tiptap](https://tiptap.dev/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **State**: React Server Components + Client Components
- **Theming**: [next-themes](https://github.com/pacocoursey/next-themes)

### Backend
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Authentication**: [Better Auth](https://www.better-auth.com/)
- **API**: Next.js API Routes

### Testing & Development
- **Testing**: [Jest](https://jestjs.io/) + [React Testing Library](https://testing-library.com/react)
- **Linting**: [ESLint](https://eslint.org/)
- **Package Manager**: npm

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js 20+** ([Download](https://nodejs.org/))
- **PostgreSQL** ([Download](https://www.postgresql.org/download/))
- **npm** (comes with Node.js)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd intellivault
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory (see `.env.example`):

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/intellivault"

# Better Auth
BETTER_AUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Environment
NODE_ENV="development"
```

**Getting Google OAuth Credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### 4. Set Up Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view/edit data
npm run prisma:studio
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
intellivault/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (app)/            # Authenticated routes
│   │   │   ├── dashboard/    # Dashboard page
│   │   │   ├── notes/        # Notes pages
│   │   │   └── tags/         # Tags management page
│   │   ├── (auth)/           # Authentication routes
│   │   └── api/              # API routes
│   │       ├── auth/         # Auth endpoints
│   │       ├── notes/        # Notes CRUD
│   │       └── tags/         # Tags management
│   ├── components/           # React components
│   │   ├── ui/              # Reusable UI components
│   │   ├── tags/            # Tag-specific components
│   │   ├── tiptap-*         # Tiptap editor components
│   │   └── *.tsx            # Feature components
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries
│   │   ├── utils/           # Helper functions
│   │   ├── validations/     # Zod schemas
│   │   ├── auth.ts          # Better Auth config
│   │   └── prisma.ts        # Prisma client
│   └── types/               # TypeScript types
├── __tests__/               # Test files
│   ├── api/                # API route tests
│   ├── hooks/              # Hook tests
│   └── lib/                # Utility tests
└── public/                  # Static assets
```

## 🗄️ Database Schema

### Core Models

**User**
- Authentication and profile information
- Relations: Notes, Tags, Sessions, Accounts

**Note**
- `id`, `title`, `contentJSON`, `contentText`
- `userId` (owner), `tags` (many-to-many)
- Timestamps: `createdAt`, `updatedAt`

**Tag**
- `id`, `name`, `slug`, `color`, `description`
- `userId` (owner), `parentId` (hierarchy)
- `isFavorite`, `isArchived`, `usageCount`, `lastUsed`
- Relations: Notes, Parent/Children, TagViews, TagRelations
- Soft delete: `deletedAt`

**TagView**
- Saved tag filters and views
- `name`, `filters` (JSON)

**TagRelation**
- Links between related tags
- `fromId`, `toId`, `strength`

**Session & Account**
- Better Auth managed models

## 🔌 API Routes

### Authentication
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signup` - Sign up
- `POST /api/auth/signout` - Sign out

### Notes
- `GET /api/notes` - List all notes (user-specific)
- `POST /api/notes` - Create note
- `GET /api/notes/[id]` - Get note details
- `PUT /api/notes/[id]` - Update note
- `DELETE /api/notes/[id]` - Delete note

### Tags
- `GET /api/tags` - List all tags (user-specific)
- `POST /api/tags` - Create tag
- `GET /api/tags/[id]` - Get tag details
- `PUT /api/tags/[id]` - Update tag
- `DELETE /api/tags/[id]` - Delete tag
- `POST /api/tags/archive/[id]` - Archive/unarchive tag
- `POST /api/tags/favorite/[id]` - Favorite/unfavorite tag
- `POST /api/tags/batch` - Bulk operations
- `GET /api/tags/analytics` - Tag usage analytics
- `POST /api/tags/export` - Export tags
- `POST /api/tags/import` - Import tags
- `POST /api/tags/merge` - Merge tags
- `GET /api/tags/related/[id]` - Get related tags
- `GET /api/tags/suggestions` - Get tag suggestions

All API routes include:
- ✅ Authentication checks
- ✅ User ownership validation
- ✅ Input validation (Zod schemas)
- ✅ Error handling
- ✅ TypeScript types

## 🎯 Development Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio

# Testing
npm run test            # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage
```

## 🧪 Testing

IntelliVault includes comprehensive unit tests covering:

- **Utility Functions**: Text manipulation, tag colors, Tiptap helpers
- **Validation Schemas**: Note validation
- **Custom Hooks**: useDebounce, use-notes
- **API Routes**: Notes and Tags endpoints

Run tests with:

```bash
npm run test              # Single run
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

## 🏗️ Architecture Highlights

### Authentication Flow
1. Better Auth handles authentication with PostgreSQL adapter
2. Google OAuth and email/password supported
3. Server-side session validation using cookies
4. Middleware protects authenticated routes
5. Cookie caching enabled for performance

### Data Isolation
- All data is user-specific via `userId` foreign keys
- API routes validate user ownership on all operations
- Prisma queries include user filters automatically

### Rich Text Editor
- Tiptap with custom extensions and UI
- JSON content storage for flexibility
- Plain text extraction for search
- Template support

### Tag System
- Hierarchical structure with parent-child relationships
- Many-to-many with notes
- Smart suggestions based on usage
- Analytics and visualization
- Bulk operations support

## 🚢 Deployment

### Environment Variables

Ensure all required environment variables are set in your production environment:

```env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="https://yourdomain.com"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NODE_ENV="production"
```

### Build & Deploy

```bash
# Build the application
npm run build

# Start production server
npm run start
```

### Recommended Platforms
- **Vercel**: Zero-config deployment for Next.js
- **Railway**: Easy PostgreSQL + App hosting
- **Render**: Full-stack deployment
- **Self-hosted**: Using Docker + PostgreSQL

### Post-Deployment
1. Run database migrations: `npm run prisma:migrate`
2. Update Google OAuth redirect URIs with production URL
3. Set secure `BETTER_AUTH_SECRET`
4. Enable HTTPS for production

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a personal project. For suggestions or issues, please open an issue on the repository.

---

**Built with ❤️ using Next.js and modern web technologies**
