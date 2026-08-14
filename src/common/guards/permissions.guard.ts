import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '../constants/permissions.constant';
import { PERMISSIONS_KEY } from '../constants/metadata.constant';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { permissions?: Permission[] };
    }>();
    const userPermissions = request.user?.permissions ?? [];

    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }
}
