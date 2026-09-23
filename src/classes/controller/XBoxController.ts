import Controller from './Controller';
import {AxisMotionData, ButtonPress} from 'sdl2-gamecontroller';
import StickMotionEvent from '../../interfaces/IStickMotionEvent';
import AppService from '../../AppService';
class XboxController extends Controller {
  // maximum stick motion driver value
  private maxStickMotionValue = 32767;

  // Left stick
  private leftStickX = 0;
  private leftStickY = 0;
  private leftStickSpeedRate = 1.3;

  // Right stick
  private rightStickX = 0;
  private rightStickY = 0;
  private rightStickSpeedRate = 2;

  // trigger left and right
  private leftTriggerSpeedRate = 1.9;
  private rightTriggerSpeedRate = 1.9;

  // trigger
  private leftTrigger = 0;
  private rightTrigger = 0;

  // Temporal smoothing for both sticks and the manual trigger zoom.
  // 250 ms is the response time used by the virtual PTZ prototype.
  private readonly smoothingDurationInMs = 250;
  private readonly smoothingIntervalInMs = 20;
  private leftStickTargetX = 0;
  private leftStickTargetY = 0;
  private rightStickTargetX = 0;
  private rightStickTargetY = 0;
  private leftTriggerTarget = 0;
  private rightTriggerTarget = 0;

  constructor(
    appService: AppService,
    product: string,
    manufacturer: string,
    controllerId: number,
    joystickDeviceIndex: number
  ) {
    super(appService, product, manufacturer, controllerId, joystickDeviceIndex);

    const smoothingTimer = setInterval(
      () => this.flushSmoothedMotion(),
      this.smoothingIntervalInMs
    );
    smoothingTimer.unref();
  }

  proxyButtonDown(data: ButtonPress): void {
    const controller = this as Controller;
    if (this.buttonDownCallback) {
      this.buttonDownCallback(
        data.button,
        this.currentCameraNumber,
        this.appService,
        controller
      );
    }
  }

  proxyLeftStickMotion(data: AxisMotionData) {
    data.value = data.value / this.leftStickSpeedRate;

    if (data.button === 'leftx') {
      this.leftStickTargetX = this.easeValue(
        (data.value / this.maxStickMotionValue) * 100,
        'cubic-bezier'
      );
    }
    if (data.button === 'lefty') {
      this.leftStickTargetY = this.easeValue(
        (data.value / this.maxStickMotionValue) * 100,
        'cubic-bezier'
      );
    }
  }

  proxyRightStickMotion(data: AxisMotionData): void {
    data.value = data.value / this.rightStickSpeedRate;

    if (data.button === 'rightx') {
      this.rightStickTargetX = this.easeValue(
        (data.value / this.maxStickMotionValue) * 100,
        'cubic-bezier'
      );
    }
    if (data.button === 'righty') {
      this.rightStickTargetY = this.easeValue(
        (data.value / this.maxStickMotionValue) * 100,
        'cubic-bezier'
      );
    }
  }
  proxyLeftTriggerMotion(data: AxisMotionData): void {
    data.value = data.value / this.leftTriggerSpeedRate;
    this.leftTriggerTarget = this.easeValue(
      (data.value / this.maxStickMotionValue) * 100,
      'cubic-bezier'
    );
  }
  proxyRightTriggerMotion(data: AxisMotionData): void {
    data.value = data.value / this.rightTriggerSpeedRate;
    this.rightTriggerTarget = this.easeValue(
      (data.value / this.maxStickMotionValue) * 100,
      'cubic-bezier'
    );
  }

  private flushSmoothedMotion(): void {
    if (!this.isConnected) {
      this.leftStickTargetX = 0;
      this.leftStickTargetY = 0;
      this.rightStickTargetX = 0;
      this.rightStickTargetY = 0;
      this.leftTriggerTarget = 0;
      this.rightTriggerTarget = 0;
    }

    const alpha =
      1 - Math.exp(-this.smoothingIntervalInMs / this.smoothingDurationInMs);

    this.leftStickX = this.smoothValue(
      this.leftStickX,
      this.leftStickTargetX,
      alpha
    );
    this.leftStickY = this.smoothValue(
      this.leftStickY,
      this.leftStickTargetY,
      alpha
    );
    this.rightStickX = this.smoothValue(
      this.rightStickX,
      this.rightStickTargetX,
      alpha
    );
    this.rightStickY = this.smoothValue(
      this.rightStickY,
      this.rightStickTargetY,
      alpha
    );
    this.leftTrigger = this.smoothValue(
      this.leftTrigger,
      this.leftTriggerTarget,
      alpha
    );
    this.rightTrigger = this.smoothValue(
      this.rightTrigger,
      this.rightTriggerTarget,
      alpha
    );

    this.emitStickMotion();
    this.emitZoomMotion();
  }

  private smoothValue(current: number, target: number, alpha: number): number {
    const smoothed = current + (target - current) * alpha;
    return Math.abs(target - smoothed) < 0.01 ? target : smoothed;
  }

  private emitStickMotion(): void {
    const leftStickMotionEvent: StickMotionEvent = {
      x: this.leftStickX,
      y: this.leftStickY,
    };
    const rightStickMotionEvent: StickMotionEvent = {
      x: this.rightStickX,
      y: this.rightStickY,
    };

    const rightStickIsActive =
      Math.abs(this.rightStickTargetX) > 0.01 ||
      Math.abs(this.rightStickTargetY) > 0.01 ||
      Math.abs(this.rightStickX) > 0.01 ||
      Math.abs(this.rightStickY) > 0.01;

    if (rightStickIsActive) {
      this.rightStickMotionCallback?.(
        rightStickMotionEvent,
        this.currentCameraNumber,
        this.appService
      );
      return;
    }

    this.leftStickMotionCallback?.(
      leftStickMotionEvent,
      this.currentCameraNumber,
      this.appService
    );
  }

  private emitZoomMotion(): void {
    const zoomSpeed = this.rightTrigger - this.leftTrigger;

    if (zoomSpeed < 0) {
      this.leftTriggerMotionCallback?.(
        Math.abs(zoomSpeed),
        this.currentCameraNumber,
        this.appService
      );
      return;
    }

    this.rightTriggerMotionCallback?.(
      zoomSpeed,
      this.currentCameraNumber,
      this.appService
    );
  }

  proxyLeftShoulderButton(data: ButtonPress): void {
    if (this.leftShoulderButtonCallback) {
      this.leftShoulderButtonCallback(
        data.button,
        this.currentCameraNumber,
        this.appService
      );
    }
  }

  proxyRightShoulderButton(data: ButtonPress): void {
    if (this.rightShoulderButtonCallback) {
      this.rightShoulderButtonCallback(
        data.button,
        this.currentCameraNumber,
        this.appService
      );
    }
  }

  private cubicInEasing(value: number): number {
    return value * value * value;
  }
}

export default XboxController;
