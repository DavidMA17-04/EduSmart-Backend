import { HttpException } from '@nestjs/common';
import { LoginAttemptsService } from './login-attempts.service';

describe('LoginAttemptsService', () => {
  const env = { ...process.env };
  let clock: number;
  let service: LoginAttemptsService;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOGIN_RATE_LIMIT;
    clock = 1_000_000;
    service = new LoginAttemptsService();
    service.now = () => clock;
  });
  afterAll(() => {
    process.env = env;
  });

  const fail = (times: number, id = '300000020', ip = '200.1.1.1') => {
    for (let i = 0; i < times; i++) service.registerFailure(id, ip);
  };

  it('permite 5 intentos fallidos y bloquea el sexto por 15 minutos', () => {
    fail(4);
    expect(() => service.assertAllowed('300000020', '200.1.1.1')).not.toThrow();
    fail(1);
    try {
      service.assertAllowed('300000020', '200.1.1.1');
      throw new Error('debía bloquear');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).getResponse()).toMatchObject({
        message: 'Demasiados intentos fallidos. Espere 15 minutos e intente de nuevo.',
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
      });
    }
  });

  it('se libera al pasar la ventana', () => {
    fail(5);
    clock += 15 * 60_000 + 1;
    expect(() => service.assertAllowed('300000020', '200.1.1.1')).not.toThrow();
  });

  it('el bloqueo es por cédula: otra persona en el mismo Wi-Fi puede entrar', () => {
    fail(5);
    expect(() => service.assertAllowed('300000030', '200.1.1.1')).not.toThrow();
  });

  it('un ingreso correcto limpia el contador de esa cédula', () => {
    fail(4);
    service.registerSuccess('300000020');
    fail(4);
    expect(() => service.assertAllowed('300000020', '200.1.1.1')).not.toThrow();
  });

  it('bloquea una IP que prueba muchas cédulas distintas', () => {
    for (let i = 0; i < 60; i++) service.registerFailure(`30000${i}`, '200.9.9.9');
    expect(() => service.assertAllowed('399999999', '200.9.9.9')).toThrow(HttpException);
  });

  it('en desarrollo no limita salvo LOGIN_RATE_LIMIT=true', () => {
    process.env.NODE_ENV = 'development';
    fail(10);
    expect(() => service.assertAllowed('300000020', '200.1.1.1')).not.toThrow();
    process.env.LOGIN_RATE_LIMIT = 'true';
    fail(5);
    expect(() => service.assertAllowed('300000020', '200.1.1.1')).toThrow(HttpException);
  });
});
