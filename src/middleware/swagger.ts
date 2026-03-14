import { Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import { specs, swaggerUiOptions } from '../config/swagger';

/**
 * Middleware to serve Swagger API documentation
 */
export const swaggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Custom middleware logic can be added here if needed
  next();
};

/**
 * Setup Swagger UI routes
 */
export const setupSwagger = (app: any) => {
  // Serve API documentation
  app.use('/api-docs', swaggerUi.serve);

  // Serve Swagger specification
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });

  // Swagger UI configuration
  app.use('/api-docs', swaggerUi.setup(specs, swaggerUiOptions));

  return app;
};
