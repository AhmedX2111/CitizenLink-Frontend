import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-logout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class Logout implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.logout();
  }
}