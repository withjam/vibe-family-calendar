# Calendar Application

## Overview

This is a full-stack calendar application built with React, Express, and PostgreSQL. The application provides a modern calendar interface for managing events with features like creating, editing, deleting, and searching events. It uses a clean, component-based architecture with a focus on user experience and responsive design.

**Status:** ✅ Baseline version complete (January 21, 2025)
- Touch-optimized interface for HD displays
- Monthly calendar view with Sunday-start weeks
- Complete event management system
- Modal-based interactions for event creation/editing
- Real-time event search functionality

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Style**: RESTful API with conventional HTTP methods
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL with Neon Database serverless driver
- **Development**: Hot reload with Vite middleware integration

### Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon Database
- **ORM**: Drizzle ORM with schema-first approach
- **Migrations**: Drizzle Kit for database schema management
- **Development Fallback**: In-memory storage for development/testing

## Recent Changes

### Baseline Implementation (January 21, 2025)
- ✅ Complete calendar data model and backend API
- ✅ Monthly calendar view with Sunday-start weeks  
- ✅ Touch-optimized interface for HD displays
- ✅ Event creation, editing, and deletion modals
- ✅ Real-time search functionality with debouncing
- ✅ Event categorization and time formatting
- ✅ Sample events for demonstration

### User Feedback
- User confirmed all requested features are working correctly
- Application ready for additional improvements

## Key Components

### Database Schema
- **Users Table**: Basic user management with username/password
- **Events Table**: Comprehensive event storage with:
  - Title, description, location
  - Start/end times with timezone support
  - Categories (work, personal, family, health, sports)
  - All-day event support
  - Reminder arrays
  - Serial ID primary keys

### Frontend Components
- **Calendar Grid**: Month view with event display, day numbers in upper-right
- **Event Management**: Touch-friendly create, edit, delete modals
- **Search Functionality**: Real-time event search with debouncing
- **Navigation**: Month/year navigation with clear button controls
- **UI Components**: Complete shadcn/ui component library
- **Touch Design**: Optimized for HD touchscreen displays

### Backend Services
- **Storage Interface**: Abstract storage layer supporting multiple implementations
- **Event API**: CRUD operations with date range filtering
- **Search API**: Text-based event search across titles and descriptions
- **Error Handling**: Centralized error middleware with proper HTTP status codes

## Data Flow

### Event Management Flow
1. User interacts with calendar interface
2. TanStack Query manages API requests and caching
3. Express routes handle HTTP requests
4. Storage layer abstracts database operations
5. Drizzle ORM executes type-safe SQL queries
6. PostgreSQL stores/retrieves data
7. Response flows back through the same layers

### Development vs Production
- **Development**: Uses Vite middleware for HMR and development features
- **Production**: Serves static files with optimized bundles
- **Database**: Seamless switching between in-memory and PostgreSQL storage

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection for serverless environments
- **drizzle-orm & drizzle-kit**: Type-safe ORM and migration tools
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **date-fns**: Date manipulation and formatting
- **zod**: Runtime type validation
- **wouter**: Lightweight React router

### Development Tools
- **@replit/vite-plugin-***: Replit-specific development enhancements
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Build Process
1. **Frontend Build**: Vite compiles React app to static assets
2. **Backend Build**: esbuild bundles server code for Node.js
3. **Database Setup**: Drizzle migrations ensure schema consistency

### Environment Configuration
- **Development**: `NODE_ENV=development` with hot reload
- **Production**: `NODE_ENV=production` with optimized builds
- **Database**: `DATABASE_URL` environment variable for PostgreSQL connection

### File Structure
- **Client**: Frontend React application in `/client`
- **Server**: Express backend in `/server`
- **Shared**: Common types and schemas in `/shared`
- **Build Output**: Static files in `/dist/public`, server bundle in `/dist`

### Production Deployment
- Built for Node.js runtime with ES modules
- Serves static React app alongside API routes
- Requires PostgreSQL database with connection string
- Supports serverless and traditional hosting environments