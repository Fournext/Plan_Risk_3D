import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, inject, PLATFORM_ID } from '@angular/core';
import { TokenStorageService } from '../../features/auth/services/tokenStorage.service';
import { isPlatformBrowser } from '@angular/common';
import { UserService } from '../../features/users/services/user.service';




@Component({
  selector: 'app-private-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './private-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateLayoutComponent {
  private tokenStorageService = inject(TokenStorageService);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private userService = inject(UserService);


  menuOpen = false;
  currentUser=computed(()=>this.userService.usuario());

  //con esto el cliente al hacer logout se elimina todos los datos del usuario del localstorage
  logout() {
    this.tokenStorageService.clear();
    this.router.navigateByUrl('login');
  }
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    const id = this.tokenStorageService.getUser()?.id ?? 0;
    this.userService.getUser(id).subscribe();//con esto traemos los datos del usuario al iniciar el layout privado
  }
}
