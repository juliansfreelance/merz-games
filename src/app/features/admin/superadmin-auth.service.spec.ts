import { TestBed } from '@angular/core/testing';
import { SuperadminAuthService } from './superadmin-auth.service';
import { SUPERADMIN_PIN } from './pin';

describe('SuperadminAuthService', () => {
  let service: SuperadminAuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SuperadminAuthService);
  });

  it('inicia bloqueado', () => {
    expect(service.isUnlocked()).toBe(false);
  });

  it('desbloquea con el PIN correcto de superadmin', () => {
    const ok = service.verify(SUPERADMIN_PIN);
    expect(ok).toBe(true);
    expect(service.isUnlocked()).toBe(true);
  });

  it('rechaza un PIN incorrecto y mantiene el bloqueo', () => {
    const ok = service.verify('999999');
    expect(ok).toBe(false);
    expect(service.isUnlocked()).toBe(false);
  });

  it('permite bloquear y desbloquear manualmente', () => {
    service.unlock();
    expect(service.isUnlocked()).toBe(true);
    service.lock();
    expect(service.isUnlocked()).toBe(false);
  });

  it('expone la frase de ayuda profesional', () => {
    expect(service.hint).toContain('Lo mejor 2026');
  });
});
