import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // In a production environment, these should be stored in a database with hashed passwords
  // For now, we'll use environment variables or hardcoded values for demo purposes
  private readonly adminUsers = [
    {
      id: 'admin-1',
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      name: 'Admin User',
      role: 'admin',
    },
  ];

  private readonly jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  private readonly jwtExpiresIn = '7d';

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { email, password } = loginDto;

    this.logger.log(`Attempting login for email: ${email}`);
    this.logger.debug(`Admin users configured: ${this.adminUsers.map(u => u.email).join(', ')}`);

    // Find user by email
    const user = this.adminUsers.find((u) => u.email === email);

    if (!user) {
      this.logger.warn(`User not found: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.password !== password) {
      this.logger.warn(`Invalid password for user: ${email}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log(`User authenticated successfully: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    // Return user info (without password) and token
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async verifyUser(userId: string): Promise<any> {
    const user = this.adminUsers.find((u) => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
