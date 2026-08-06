import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  templateUrl: './forbidden.component.html'
})
export class ForbiddenComponent {}
