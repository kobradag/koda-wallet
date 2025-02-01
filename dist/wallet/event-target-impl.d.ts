export declare type Event = {
    type: string;
    detail: any;
    defaultPrevented: boolean;
};
export declare type EventListener = (detail: any, event: Event) => void;
export declare class EventTargetImpl {
    listeners: Map<string, EventListener[]>;
    constructor();
    /**
    * fire CustomEvent
    * @param {String} eventName name of event
    * @param {Object=} detail event's [detail]{@link https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail} property
    * @since 0.0.1
    */
    emit(type: string, detail?: any): void;
    on(type: string, callback: EventListener): void;
    addEventListener(type: string, callback: EventListener): void;
    removeEventListener(type: string, callback: EventListener): void;
    dispatchEvent(event: Event): boolean;
}
//# sourceMappingURL=event-target-impl.d.ts.map