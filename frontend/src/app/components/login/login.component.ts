import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  mode: 'login' | 'register' = 'login';
  employeeCode = '';
  fullName = '';
  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  private resolveError(err: any, fallback: string): string {
    if (err?.status === 0) {
      return 'Connessione al backend fallita o CORS bloccato';
    }
    return err?.error?.message || err?.error?.detail || err?.error?.error || err?.statusText || fallback;
  }

  login(): void {
    this.errorMessage = '';
    this.loading = true;

    if (this.mode === 'register') {
      this.authService
        .register(this.employeeCode, this.fullName, this.email, this.password)
        .subscribe({
          next: () => this.router.navigate(['/dashboard']),
          error: (err) => {
            this.errorMessage = this.resolveError(err, 'Registrazione non riuscita');
            this.loading = false;
          }
        });
      return;
    }

    this.authService.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.errorMessage = this.resolveError(err, 'Login non riuscito');
        this.loading = false;
      }
    });
  }

  toggleMode(mode: 'login' | 'register'): void {
    this.mode = mode;
    this.errorMessage = '';
  }
}
