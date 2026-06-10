import { Component, OnInit } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-logout',
  templateUrl: './logout.component.html',
  styleUrls: ['./logout.component.css']
})
export class Logout implements OnInit {
  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.logout();
  }
}