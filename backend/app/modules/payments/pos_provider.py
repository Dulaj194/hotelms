import hashlib
import hmac
import json
import time
import uuid

# In a real environment, this would call the actual Bank/Gateway APIs.
# For this SaaS, we simulate the Cloud Server of the POS Terminal Provider.

class MockTerminalProvider:
    """Simulates a POS Provider Cloud API (e.g. Stripe Terminal, Local Bank API)."""
    
    @staticmethod
    def push_payment(
        merchant_id: str,
        terminal_id: str,
        api_key: str | None,
        amount: float,
        session_id: str
    ) -> dict:
        """
        Simulates pushing a payment amount to a physical card machine.
        Returns a provider reference and status.
        """
        # Simulate network delay
        time.sleep(0.5)
        
        # In reality, this would make an HTTP POST to the bank's API
        provider_ref = f"pos_intent_{uuid.uuid4().hex[:12]}"
        
        # The machine will stay pending until a webhook is fired (simulated separately)
        return {
            "status": "pending",
            "provider_reference": provider_ref,
            "message": "Payment pushed to machine successfully."
        }

    @staticmethod
    def check_terminal_online(
        merchant_id: str,
        terminal_id: str,
        api_key: str | None
    ) -> bool:
        """
        Simulates checking if a terminal is online and ready to accept payments.
        We'll just return True for the simulator.
        """
        return True

    @staticmethod
    def check_payment_status(provider_reference: str, api_key: str | None) -> dict:
        """
        Simulates polling the bank server for the status of a specific payment.
        Since we are a simulator and don't have a real stateful backend for the bank,
        we'll randomly return 'pending' or 'failed' if queried directly, or we can just
        return 'pending' and rely on the webhook simulator to complete it.
        """
        return {
            "status": "pending",
            "provider_reference": provider_reference
        }

    @staticmethod
    def generate_webhook_signature(payload: dict, secret: str) -> str:
        """
        Generates an HMAC-SHA256 signature for the webhook payload.
        This is what the Bank server does. Our backend will verify this.
        """
        payload_bytes = json.dumps(payload, separators=(',', ':')).encode("utf-8")
        secret_bytes = secret.encode("utf-8")
        signature = hmac.new(secret_bytes, payload_bytes, hashlib.sha256).hexdigest()
        return f"t={int(time.time())},v1={signature}"

    @staticmethod
    def verify_webhook_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
        """
        Verifies the HMAC-SHA256 signature sent by the bank.
        """
        try:
            parts = dict(item.split('=') for item in signature_header.split(','))
            timestamp = parts.get('t')
            provided_signature = parts.get('v1')
            
            if not timestamp or not provided_signature:
                return False
                
            # Prevent replay attacks (e.g. older than 5 minutes)
            if time.time() - int(timestamp) > 300:
                return False
                
            secret_bytes = secret.encode("utf-8")
            expected_signature = hmac.new(secret_bytes, payload_bytes, hashlib.sha256).hexdigest()
            
            # Use hmac.compare_digest to prevent timing attacks
            return hmac.compare_digest(expected_signature, provided_signature)
        except Exception:
            return False
