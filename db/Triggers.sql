CREATE OR REPLACE TRIGGER TRG_PREVENT_DOUBLE_BOOKING
BEFORE INSERT ON TICKET
FOR EACH ROW
DECLARE
    v_is_occupied VARCHAR2(20);
BEGIN
    SELECT is_occupied INTO v_is_occupied
    FROM ParkingSlot
    WHERE slot_id = :new.slot_id;

    IF v_is_occupied = 'Y' THEN
        RAISE_APPLICATION_ERROR(-20001, 'Slot is already occupied');
    END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_SYNC_SLOT_STATUS
AFTER INSERT OR UPDATE ON TICKET
FOR EACH ROW
BEGIN
    IF :new.status = 'ACTIVE' THEN
        UPDATE ParkingSlot SET is_occupied = 'Y' WHERE slot_id = :new.slot_id;
    ELSIF :new.status = 'CLOSED' THEN
        UPDATE ParkingSlot SET is_occupied = 'N' WHERE slot_id = :new.slot_id;
    END IF;
END;
/

CREATE OR REPLACE TRIGGER TRG_VALIDATE_PAYMENT
BEFORE INSERT ON PAYMENT
FOR EACH ROW
DECLARE
    v_ticket_status VARCHAR2(20);
BEGIN
    -- Verify ticket exists and get its status
    BEGIN
        SELECT status INTO v_ticket_status
        FROM TICKET
        WHERE ticket_id = :new.ticket_id;
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RAISE_APPLICATION_ERROR(-20005, 'Invalid ticket ID: Ticket does not exist.');
    END;

    -- Make sure we are paying for a ticket that isn't already closed
    IF v_ticket_status = 'CLOSED' THEN
         RAISE_APPLICATION_ERROR(-20006, 'Invalid payment: Ticket is already closed.');
    END IF;

    -- Validate amount
    IF :new.amount <= 0 THEN
        RAISE_APPLICATION_ERROR(-20007, 'Invalid payment amount: Must be greater than 0.');
    END IF;
END;
/
