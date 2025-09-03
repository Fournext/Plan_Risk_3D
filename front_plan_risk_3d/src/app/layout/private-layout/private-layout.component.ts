import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ChangeDetectionStrategy, Component } from '@angular/core';




@Component({
  selector: 'app-private-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './private-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateLayoutComponent {
  menuOpen = false;
}
