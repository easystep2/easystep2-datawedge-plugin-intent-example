import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

declare let window: any;

export interface ScanResult {
  data: string;
  labelType: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DataWedgeService {
  private readonly PROFILE_NAME = 'EasyStep2TestApp';
  private readonly PACKAGE_NAME = 'io.ionic.starter';
  
  // DataWedge intent actions
  private readonly DW_API_ACTION = 'com.symbol.datawedge.api.ACTION';
  private readonly DW_RESULT_ACTION = 'com.symbol.datawedge.api.RESULT_ACTION';
  private readonly SCAN_ACTION = 'com.easystep2.ACTION.BARCODE_SCAN';
  
  private scannedData$ = new BehaviorSubject<ScanResult | null>(null);
  private scanHistory$ = new BehaviorSubject<ScanResult[]>([]);
  private isInitialized$ = new BehaviorSubject<boolean>(false);
  private statusMessage$ = new BehaviorSubject<string>('Initializing...');

  constructor(private ngZone: NgZone) {}

  get scannedData(): Observable<ScanResult | null> {
    return this.scannedData$.asObservable();
  }

  get scanHistory(): Observable<ScanResult[]> {
    return this.scanHistory$.asObservable();
  }

  get isInitialized(): Observable<boolean> {
    return this.isInitialized$.asObservable();
  }

  get statusMessage(): Observable<string> {
    return this.statusMessage$.asObservable();
  }

  initialize(): void {
    if (!window.plugins || !window.plugins.intentShim) {
      this.statusMessage$.next('Error: IntentShim plugin not available');
      console.error('IntentShim plugin not available');
      return;
    }

    this.statusMessage$.next('Registering broadcast receiver...');
    this.registerBroadcastReceiver();
    
    // Wait a bit for the receiver to be ready, then create the profile
    setTimeout(() => {
      this.createDataWedgeProfile();
    }, 500);
  }

  private registerBroadcastReceiver(): void {
    const intentShim = window.plugins.intentShim;
    
    intentShim.registerBroadcastReceiver(
      {
        filterActions: [
          this.SCAN_ACTION,
          this.DW_RESULT_ACTION,
          'com.symbol.datawedge.api.RESULT_GET_VERSION_INFO'
        ],
        filterCategories: ['android.intent.category.DEFAULT']
      },
      (intent: any) => {
        this.ngZone.run(() => {
          this.handleIntent(intent);
        });
      }
    );
  }

  private handleIntent(intent: any): void {
    console.log('Received intent:', JSON.stringify(intent));

    if (intent.action === this.SCAN_ACTION) {
      this.handleScanIntent(intent);
    } else if (intent.action === this.DW_RESULT_ACTION) {
      this.handleDataWedgeResult(intent);
    }
  }

  private handleScanIntent(intent: any): void {
    const extras = intent.extras || {};
    
    // DataWedge sends barcode data in these extras
    const barcodeData = extras['com.symbol.datawedge.data_string'] || 
                        extras['com.easystep2.DATA'] ||
                        extras['data'] || 
                        'Unknown';
    
    const labelType = extras['com.symbol.datawedge.label_type'] ||
                      extras['com.easystep2.LABEL_TYPE'] ||
                      extras['labelType'] || 
                      'Unknown';

    const scanResult: ScanResult = {
      data: barcodeData,
      labelType: labelType,
      timestamp: new Date()
    };

    console.log('Scan result:', scanResult);
    this.scannedData$.next(scanResult);
    
    // Add to history
    const history = this.scanHistory$.value;
    this.scanHistory$.next([scanResult, ...history].slice(0, 50)); // Keep last 50 scans
    
    this.statusMessage$.next(`Last scan: ${new Date().toLocaleTimeString()}`);
  }

  private handleDataWedgeResult(intent: any): void {
    const extras = intent.extras || {};
    console.log('DataWedge result:', extras);
    
    if (extras['COMMAND_IDENTIFIER'] === 'CREATE_PROFILE' || 
        extras['RESULT_INFO']) {
      const result = extras['RESULT'] || extras['RESULT_INFO'];
      if (result === 'SUCCESS' || result?.RESULT === 'SUCCESS') {
        this.statusMessage$.next('Profile created successfully');
        this.isInitialized$.next(true);
      } else {
        // Profile might already exist, which is fine
        this.statusMessage$.next('Ready for scanning');
        this.isInitialized$.next(true);
      }
    }
  }

  private createDataWedgeProfile(): void {
    this.statusMessage$.next('Creating DataWedge profile...');
    
    const intentShim = window.plugins.intentShim;

    // Step 1: Create profile
    intentShim.sendBroadcast(
      {
        action: this.DW_API_ACTION,
        extras: {
          'com.symbol.datawedge.api.CREATE_PROFILE': this.PROFILE_NAME
        }
      },
      () => {
        console.log('Create profile broadcast sent');
        // Step 2: Configure the profile
        setTimeout(() => this.configureProfile(), 300);
      },
      (error: any) => {
        console.error('Error creating profile:', error);
        this.statusMessage$.next('Error creating profile');
      }
    );
  }

  private configureProfile(): void {
    this.statusMessage$.next('Configuring profile...');
    
    const intentShim = window.plugins.intentShim;

    const profileConfig = {
      PROFILE_NAME: this.PROFILE_NAME,
      PROFILE_ENABLED: 'true',
      CONFIG_MODE: 'UPDATE',
      PLUGIN_CONFIG: {
        PLUGIN_NAME: 'INTENT',
        RESET_CONFIG: 'true',
        PARAM_LIST: {
          intent_output_enabled: 'true',
          intent_action: this.SCAN_ACTION,
          intent_delivery: '2' // Broadcast
        }
      },
      APP_LIST: [
        {
          PACKAGE_NAME: this.PACKAGE_NAME,
          ACTIVITY_LIST: ['*']
        }
      ]
    };

    intentShim.sendBroadcast(
      {
        action: this.DW_API_ACTION,
        extras: {
          'com.symbol.datawedge.api.SET_CONFIG': profileConfig
        }
      },
      () => {
        console.log('Profile configuration sent');
        this.statusMessage$.next('Ready for scanning');
        this.isInitialized$.next(true);
      },
      (error: any) => {
        console.error('Error configuring profile:', error);
        this.statusMessage$.next('Error configuring profile');
      }
    );
  }

  clearHistory(): void {
    this.scanHistory$.next([]);
    this.scannedData$.next(null);
  }

  destroy(): void {
    if (window.plugins && window.plugins.intentShim) {
      window.plugins.intentShim.unregisterBroadcastReceiver();
    }
  }
}
