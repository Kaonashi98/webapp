import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

interface AuthResponse {
  token: string;
  userId: number;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = 'http://localhost:8080/api';
  private readonly tokenKey = 'deskbooking_token';
  private readonly userSubject = new BehaviorSubject<AuthUser | null>(null);

  user$ = this.userSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/login`, { email, password }).pipe(
      tap((res) => this.setSession(res))
    );
  }

  register(employeeCode: string, fullName: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/auth/register`, {
      employeeCode,
      fullName,
      email,
      password
    }).pipe(tap((res) => this.setSession(res)));
  }

  me(): Observable<AuthUser> {
    return this.http.get<AuthUser>(`${this.api}/auth/me`).pipe(
      tap((user) => this.userSubject.next(user))
    );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.userSubject.next(null);
  }

  private setSession(res: AuthResponse): void {
    localStorage.setItem(this.tokenKey, res.token);
    this.userSubject.next({
      id: res.userId,
      fullName: res.fullName,
      email: res.email,
      role: res.role
    });
  }
}
