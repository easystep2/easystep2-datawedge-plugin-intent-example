import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, 
  IonCardTitle, IonCardContent, IonIcon, IonList, IonItem, IonLabel, 
  IonBadge, IonButton, Platform
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, hourglass, barcodeOutline, trashOutline } from 'ionicons/icons';
import { Observable, Subscription } from 'rxjs';
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
  private readonly DEBUG_PREFIX = '[HomePage]';
  
  lastScan$: Observable<ScanResult | null>;
  scanHistory$: Observable<ScanResult[]>;
  isInitialized$: Observable<boolean>;
  statusMessage$: Observable<string>;
  profileName: string;

  private subscriptions: Subscription[] = [];

  constructor(
    private dataWedgeService: DataWedgeService,
    private platform: Platform
  ) {
    this.logDebug('Component constructor called');
    
    addIcons({ checkmarkCircle, hourglass, barcodeOutline, trashOutline });
    this.logDebug('Icons registered:', ['checkmarkCircle', 'hourglass', 'barcodeOutline', 'trashOutline']);
    
    this.lastScan$ = this.dataWedgeService.scannedData;
    this.scanHistory$ = this.dataWedgeService.scanHistory;
    this.isInitialized$ = this.dataWedgeService.isInitialized;
    this.statusMessage$ = this.dataWedgeService.statusMessage;
    this.profileName = this.dataWedgeService.getProfileName();

    this.logDebug('DataWedge profile name:', this.profileName);
    this.logDebug('Observables initialized');

    // Subscribe to observables for debugging
    this.setupDebugSubscriptions();
  }

  private logDebug(message: string, data?: any): void {
    if (data !== undefined) {
      console.log(`${this.DEBUG_PREFIX} ${message}`, data);
    } else {
      console.log(`${this.DEBUG_PREFIX} ${message}`);
    }
  }

  private logInfo(message: string, data?: any): void {
    if (data !== undefined) {
      console.info(`${this.DEBUG_PREFIX} ℹ️ ${message}`, data);
    } else {
      console.info(`${this.DEBUG_PREFIX} ℹ️ ${message}`);
    }
  }

  private setupDebugSubscriptions(): void {
    this.logDebug('Setting up debug subscriptions for observables...');

    // Log status message changes
    this.subscriptions.push(
      this.statusMessage$.subscribe(status => {
        this.logDebug('Status message changed:', status);
      })
    );

    // Log initialization state changes
    this.subscriptions.push(
      this.isInitialized$.subscribe(initialized => {
        this.logInfo('Initialization state changed:', initialized);
      })
    );

    // Log new scans
    this.subscriptions.push(
      this.lastScan$.subscribe(scan => {
        if (scan) {
          this.logInfo('New scan received in component:', scan);
        }
      })
    );

    // Log history changes
    this.subscriptions.push(
      this.scanHistory$.subscribe(history => {
        this.logDebug('Scan history updated, count:', history.length);
      })
    );
  }

  ngOnInit(): void {
    this.logInfo('ngOnInit - Component initializing...');
    this.logDebug('Waiting for platform ready...');
    
    this.platform.ready().then(() => {
      this.logDebug('Platform ready');
      this.logDebug('Platform info:', {
        isAndroid: this.platform.is('android'),
        isIOS: this.platform.is('ios'),
        isCapacitor: this.platform.is('capacitor'),
        isCordova: this.platform.is('cordova'),
        isHybrid: this.platform.is('hybrid'),
        isMobile: this.platform.is('mobile'),
        isDesktop: this.platform.is('desktop'),
        platforms: this.platform.platforms()
      });

      if (this.platform.is('android')) {
        this.logInfo('Android platform detected - initializing DataWedge service (Capacitor)');
        this.dataWedgeService.initialize().catch(error => {
          console.error(`${this.DEBUG_PREFIX} ❌ Error initializing DataWedge service:`, error);
        });
      } else {
        this.logDebug('Not Android platform - DataWedge service not initialized');
        console.warn(`${this.DEBUG_PREFIX} ⚠️ DataWedge only works on Android Zebra devices with DataWedge installed`);
      }
    });
  }

  ngOnDestroy(): void {
    this.logInfo('ngOnDestroy - Component destroying...');
    
    // Unsubscribe from all debug subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.logDebug('Debug subscriptions unsubscribed');
    
    this.dataWedgeService.destroy().catch(error => {
      console.error(`${this.DEBUG_PREFIX} ❌ Error destroying DataWedge service:`, error);
    });
    this.logDebug('DataWedge service destroyed');
  }

  clearHistory(): void {
    this.logInfo('Clear history button clicked');
    this.dataWedgeService.clearHistory();
  }
}
