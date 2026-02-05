import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonIcon, IonList, IonItem, IonLabel, 
  IonBadge, IonButton, Platform
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, hourglass, barcodeOutline, trashOutline } from 'ionicons/icons';
import { Observable } from 'rxjs';
import { DataWedgeService, ScanResult } from '../services/datawedge.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader,
    IonCardTitle, IonCardContent, IonIcon, IonList, IonItem, IonLabel,
    IonBadge, IonButton
  ],
})
export class HomePage implements OnInit, OnDestroy {
  lastScan$: Observable<ScanResult | null>;
  scanHistory$: Observable<ScanResult[]>;
  isInitialized$: Observable<boolean>;
  statusMessage$: Observable<string>;

  constructor(
    private dataWedgeService: DataWedgeService,
    private platform: Platform
  ) {
    addIcons({ checkmarkCircle, hourglass, barcodeOutline, trashOutline });
    
    this.lastScan$ = this.dataWedgeService.scannedData;
    this.scanHistory$ = this.dataWedgeService.scanHistory;
    this.isInitialized$ = this.dataWedgeService.isInitialized;
    this.statusMessage$ = this.dataWedgeService.statusMessage;
  }

  ngOnInit(): void {
    this.platform.ready().then(() => {
      // Initialize DataWedge when platform is ready
      if (this.platform.is('android')) {
        this.dataWedgeService.initialize();
      }
    });
  }

  ngOnDestroy(): void {
    this.dataWedgeService.destroy();
  }

  clearHistory(): void {
    this.dataWedgeService.clearHistory();
  }
}
