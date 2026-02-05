import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, AlertController } from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButton],
})
export class HomePage {
  constructor(private alertController: AlertController) {}

  async showAlert() {
    const alert = await this.alertController.create({
      header: 'Alert',
      message: 'test',
      buttons: ['OK']
    });
    await alert.present();
  }
}
