import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { IntentShim, IntentShimPlugin } from 'com-easystep2-datawedge-plugin-intent-capacitor';
import { Capacitor } from '@capacitor/core';

export interface ScanResult {
  data: string;
  labelType: string;
  timestamp: Date;
}

// Extend the plugin type to include addListener from Capacitor
type IntentShimWithListeners = IntentShimPlugin & {
  addListener(eventName: 'onIntent', callback: (intent: any) => void): Promise<{ remove: () => Promise<void> }>;
};

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

  // Debug prefix for easy filtering in console
  private readonly DEBUG_PREFIX = '[DataWedge]';

  // Capacitor listener handle for cleanup
  private intentListenerHandle: { remove: () => Promise<void> } | null = null;

  constructor(private ngZone: NgZone) {
    this.logDebug('Service instantiated (Capacitor version)');
    this.logDebug('Configuration:', {
      PROFILE_NAME: this.PROFILE_NAME,
      PACKAGE_NAME: this.PACKAGE_NAME,
      DW_API_ACTION: this.DW_API_ACTION,
      DW_RESULT_ACTION: this.DW_RESULT_ACTION,
      SCAN_ACTION: this.SCAN_ACTION
    });
  }

  // ==================== DEBUG LOGGING METHODS ====================
  
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

  private logSuccess(message: string, data?: any): void {
    if (data !== undefined) {
      console.log(`${this.DEBUG_PREFIX} ✅ ${message}`, data);
    } else {
      console.log(`${this.DEBUG_PREFIX} ✅ ${message}`);
    }
  }

  private logWarning(message: string, data?: any): void {
    if (data !== undefined) {
      console.warn(`${this.DEBUG_PREFIX} ⚠️ ${message}`, data);
    } else {
      console.warn(`${this.DEBUG_PREFIX} ⚠️ ${message}`);
    }
  }

  private logError(message: string, data?: any): void {
    if (data !== undefined) {
      console.error(`${this.DEBUG_PREFIX} ❌ ${message}`, data);
    } else {
      console.error(`${this.DEBUG_PREFIX} ❌ ${message}`);
    }
  }

  // ==================== PUBLIC GETTERS ====================

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

  getProfileName(): string {
    return this.PROFILE_NAME;
  }

  // ==================== INITIALIZATION ====================

  async initialize(): Promise<void> {
    this.logInfo('Initializing DataWedge service (Capacitor)...');
    this.logDebug('Checking for IntentShim Capacitor plugin availability...');

    try {
      // Test if the plugin is available by checking if it has methods
      if (!IntentShim || typeof IntentShim.registerBroadcastReceiver !== 'function') {
        this.logError('IntentShim Capacitor plugin not available or not properly loaded');
        this.statusMessage$.next('Error: IntentShim plugin not available');
        return;
      }

      this.logSuccess('IntentShim Capacitor plugin found');
      this.logDebug('Available plugin methods:', Object.keys(IntentShim));

      this.statusMessage$.next('Setting up intent listener...');
      await this.setupIntentListener();
      
      this.statusMessage$.next('Registering broadcast receiver...');
      await this.registerBroadcastReceiver();
      
      // Wait a bit for the receiver to be ready, then create the profile
      this.logDebug('Waiting 500ms before creating DataWedge profile...');
      setTimeout(() => {
        this.createDataWedgeProfile();
      }, 500);

    } catch (error) {
      this.logError('Error during initialization:', error);
      this.statusMessage$.next('Error: Initialization failed');
    }
  }

  // ==================== INTENT LISTENER (Capacitor) ====================

  private async setupIntentListener(): Promise<void> {
    this.logInfo('Setting up Capacitor intent listener...');

    try {
      // Cast to extended type that includes addListener
      const intentShim = IntentShim as IntentShimWithListeners;
      
      // Use Capacitor's addListener for the 'onIntent' event
      this.intentListenerHandle = await intentShim.addListener('onIntent', (intent: any) => {
        this.logDebug('========== INTENT RECEIVED (Capacitor) ==========');
        this.logDebug('Raw intent object:', intent);
        this.logDebug('Intent action:', intent.action);
        this.logDebug('Intent extras:', intent.extras);
        this.logDebug('Intent data:', intent.data);
        this.logDebug('Intent type:', intent.type);
        this.logDebug('=================================================');
        
        this.ngZone.run(() => {
          this.handleIntent(intent);
        });
      });

      this.logSuccess('Capacitor intent listener registered successfully');
    } catch (error) {
      this.logError('Error setting up intent listener:', error);
      throw error;
    }
  }

  // ==================== BROADCAST RECEIVER ====================

  private async registerBroadcastReceiver(): Promise<void> {
    this.logInfo('Registering broadcast receiver...');
    
    const filterConfig = {
      filterActions: [
        this.SCAN_ACTION,
        this.DW_RESULT_ACTION,
        'com.symbol.datawedge.api.RESULT_GET_VERSION_INFO'
      ]
    };

    this.logDebug('Broadcast receiver filter configuration:', filterConfig);

    try {
      await IntentShim.registerBroadcastReceiver(filterConfig);
      this.logSuccess('Broadcast receiver registered successfully');
    } catch (error) {
      this.logError('Error registering broadcast receiver:', error);
      throw error;
    }
  }

  // ==================== INTENT HANDLING ====================

  private handleIntent(intent: any): void {
    this.logInfo('Processing received intent...');
    this.logDebug('Intent action to match:', intent.action);

    if (intent.action === this.SCAN_ACTION) {
      this.logInfo('Intent matched SCAN_ACTION - processing as barcode scan');
      this.handleScanIntent(intent);
    } else if (intent.action === this.DW_RESULT_ACTION) {
      this.logInfo('Intent matched DW_RESULT_ACTION - processing as DataWedge result');
      this.handleDataWedgeResult(intent);
    } else {
      this.logWarning('Unknown intent action received:', intent.action);
      this.logDebug('Expected actions:', [this.SCAN_ACTION, this.DW_RESULT_ACTION]);
    }
  }

  private handleScanIntent(intent: any): void {
    this.logInfo('========== BARCODE SCAN RECEIVED ==========');
    
    const extras = intent.extras || {};
    this.logDebug('Scan intent extras (all keys):', Object.keys(extras));
    this.logDebug('Scan intent extras (full object):', extras);
    
    // DataWedge sends barcode data in these extras - try multiple possible keys
    const possibleDataKeys = [
      'com.symbol.datawedge.data_string',
      'com.easystep2.DATA',
      'data'
    ];
    
    const possibleLabelKeys = [
      'com.symbol.datawedge.label_type',
      'com.easystep2.LABEL_TYPE',
      'labelType'
    ];

    this.logDebug('Searching for barcode data in keys:', possibleDataKeys);
    this.logDebug('Searching for label type in keys:', possibleLabelKeys);

    let barcodeData = 'Unknown';
    let foundDataKey = 'none';
    for (const key of possibleDataKeys) {
      if (extras[key]) {
        barcodeData = extras[key];
        foundDataKey = key;
        break;
      }
    }

    let labelType = 'Unknown';
    let foundLabelKey = 'none';
    for (const key of possibleLabelKeys) {
      if (extras[key]) {
        labelType = extras[key];
        foundLabelKey = key;
        break;
      }
    }

    this.logDebug('Barcode data found in key:', foundDataKey);
    this.logDebug('Label type found in key:', foundLabelKey);

    const scanResult: ScanResult = {
      data: barcodeData,
      labelType: labelType,
      timestamp: new Date()
    };

    this.logSuccess('Barcode scan processed:', scanResult);
    this.logInfo(`Scanned: "${barcodeData}" (Type: ${labelType})`);
    this.logInfo('===========================================');

    this.scannedData$.next(scanResult);
    
    // Add to history
    const history = this.scanHistory$.value;
    const newHistory = [scanResult, ...history].slice(0, 50);
    this.scanHistory$.next(newHistory);
    this.logDebug('Scan history updated, total scans:', newHistory.length);
    
    this.statusMessage$.next(`Last scan: ${new Date().toLocaleTimeString()}`);
  }

  private handleDataWedgeResult(intent: any): void {
    this.logInfo('========== DATAWEDGE RESULT ==========');
    
    const extras = intent.extras || {};
    this.logDebug('DataWedge result extras:', extras);
    this.logDebug('COMMAND_IDENTIFIER:', extras['COMMAND_IDENTIFIER']);
    this.logDebug('RESULT:', extras['RESULT']);
    this.logDebug('RESULT_INFO:', extras['RESULT_INFO']);
    this.logDebug('RESULT_CODE:', extras['RESULT_CODE']);
    
    if (extras['COMMAND_IDENTIFIER'] === 'CREATE_PROFILE' || 
        extras['RESULT_INFO']) {
      const result = extras['RESULT'] || extras['RESULT_INFO'];
      this.logDebug('Processing result value:', result);
      
      if (result === 'SUCCESS' || result?.RESULT === 'SUCCESS') {
        this.logSuccess('DataWedge profile created/configured successfully');
        this.statusMessage$.next('Profile created successfully');
        this.isInitialized$.next(true);
      } else {
        // Profile might already exist, which is fine
        this.logWarning('DataWedge result was not SUCCESS, but continuing...', result);
        this.statusMessage$.next('Ready for scanning');
        this.isInitialized$.next(true);
      }
    } else {
      this.logDebug('Unhandled DataWedge result type');
    }
    
    this.logInfo('======================================');
  }

  // ==================== PROFILE CREATION ====================

  private async createDataWedgeProfile(): Promise<void> {
    this.logInfo('Creating DataWedge profile...');
    this.statusMessage$.next('Creating DataWedge profile...');

    const createProfileExtras = {
      'com.symbol.datawedge.api.CREATE_PROFILE': this.PROFILE_NAME
    };

    this.logDebug('Sending CREATE_PROFILE broadcast:', {
      action: this.DW_API_ACTION,
      extras: createProfileExtras
    });

    try {
      await IntentShim.sendBroadcast({
        action: this.DW_API_ACTION,
        extras: createProfileExtras
      });

      this.logSuccess('CREATE_PROFILE broadcast sent successfully');
      this.logDebug('Waiting 300ms before configuring profile...');
      
      setTimeout(() => this.configureProfile(), 300);
    } catch (error) {
      this.logError('Error sending CREATE_PROFILE broadcast:', error);
      this.statusMessage$.next('Error creating profile');
    }
  }

  private async configureProfile(): Promise<void> {
    this.logInfo('Configuring DataWedge profile...');
    this.statusMessage$.next('Configuring profile...');

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
          intent_delivery: '2' // Broadcast (0 = Start Activity, 1 = Start Service, 2 = Broadcast)
        }
      },
      APP_LIST: [
        {
          PACKAGE_NAME: this.PACKAGE_NAME,
          ACTIVITY_LIST: ['*']
        }
      ]
    };

    this.logDebug('Profile configuration object:', profileConfig);
    this.logDebug('Intent output settings:', {
      action: this.SCAN_ACTION,
      delivery: 'Broadcast (2)'
    });
    this.logDebug('Associated app:', {
      package: this.PACKAGE_NAME,
      activities: '*'
    });

    const setConfigExtras = {
      'com.symbol.datawedge.api.SET_CONFIG': profileConfig
    };

    this.logDebug('Sending SET_CONFIG broadcast:', {
      action: this.DW_API_ACTION,
      extras: setConfigExtras
    });

    try {
      await IntentShim.sendBroadcast({
        action: this.DW_API_ACTION,
        extras: setConfigExtras
      });

      this.logSuccess('SET_CONFIG broadcast sent successfully');
      this.logSuccess('DataWedge profile configured - ready for scanning');
      this.statusMessage$.next('Ready for scanning');
      this.isInitialized$.next(true);
    } catch (error) {
      this.logError('Error sending SET_CONFIG broadcast:', error);
      this.statusMessage$.next('Error configuring profile');
    }
  }

  // ==================== PUBLIC METHODS ====================

  clearHistory(): void {
    this.logInfo('Clearing scan history...');
    this.scanHistory$.next([]);
    this.scannedData$.next(null);
    this.logSuccess('Scan history cleared');
  }

  async destroy(): Promise<void> {
    this.logInfo('Destroying DataWedge service...');
    
    try {
      // Remove the intent listener
      if (this.intentListenerHandle) {
        this.logDebug('Removing intent listener...');
        await this.intentListenerHandle.remove();
        this.intentListenerHandle = null;
        this.logSuccess('Intent listener removed');
      }

      // Unregister broadcast receiver
      this.logDebug('Unregistering broadcast receiver...');
      await IntentShim.unregisterBroadcastReceiver();
      this.logSuccess('Broadcast receiver unregistered');
    } catch (error) {
      this.logWarning('Error during cleanup:', error);
    }
  }
}
