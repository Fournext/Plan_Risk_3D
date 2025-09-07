import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TokenStorageService } from '../../features/auth/services/tokenStorage.service';




@Component({
  selector: 'app-private-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './private-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateLayoutComponent {
  tokenStorageService = inject(TokenStorageService);
  router = inject(Router);


  menuOpen = false;

  //con esto el cliente al hacer logout se elimina todos los datos del usuario del localstorage
  logout() {
    this.tokenStorageService.clear();
    this.router.navigateByUrl('login');
  }
}
